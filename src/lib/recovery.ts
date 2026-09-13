import { getPrisma } from "../db/client.ts";
import { sendMail } from "./mailer.ts";
import { precioPara } from "./precio.ts";

/**
 * Secuencia de recuperación para transcripciones bloqueadas (preview lista, no pagadas):
 *  1) +1h  — tu transcripción está lista para desbloquear
 *  2) +8h  — recordatorio
 *  3) +24h — aviso: el archivo se borra en ~12 horas (el borrado real es a las 36h)
 * Se envía al contactEmail (o al email de la cuenta). Al pagar, locked=false y la secuencia para sola.
 */

const STAGES = [
  { stage: 1, afterH: 1 },
  { stage: 2, afterH: 8 },
  { stage: 3, afterH: 24 },
];

const FOOTER_TXT: Record<string, string> = {
  en: "You're receiving this because you uploaded a file to voicetotexts.net.",
  es: "Recibes este mensaje porque subiste un archivo a voicetotexts.net.",
  it: "Ricevi questo messaggio perché hai caricato un file su voicetotexts.net.",
  de: "Sie erhalten diese Nachricht, weil Sie eine Datei auf voicetotexts.net hochgeladen haben.",
};
const footer = (locale: string) => `
  <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#94a3b8;font-size:12px;line-height:1.5">
    ${FOOTER_TXT[locale] || FOOTER_TXT.en}<br/>
    Voice To Text · a product of 1mmObj LLC · 1209 Mountain Road Pl NE, Ste N, Albuquerque, NM 87110, USA
  </p>`;

// Plantillas por idioma (es/en/it/de; el resto cae a en). Sin "download": "exportar".
const T: Record<string, (s: number, today: string) => { subject: string; open: string; body: string; cta: string }> = {
  en: (s, today) => [
    { subject: "Your transcription is ready to unlock 🔓", open: "Good news — we already transcribed the beginning of your file.", body: "Unlock the <b>full transcription</b>, edit it and export it as TXT, DOCX, PDF, SRT or CSV.", cta: `Unlock now — ${today}` },
    { subject: "Still need your transcription?", open: "Your transcription is still waiting for you.", body: `It takes less than a minute to unlock it — ${today} today.`, cta: "Open my transcription" },
    { subject: "⚠️ Your file will be deleted in 12 hours", open: "Heads up: to protect your privacy, we automatically delete uploaded files.", body: "<b>Your file will be deleted in about 12 hours.</b> Unlock your transcription now to keep it.", cta: `Unlock before it's gone — ${today}` },
  ][s - 1]!,
  es: (s, today) => [
    { subject: "Tu transcripción está lista para desbloquear 🔓", open: "Buenas noticias: ya transcribimos el principio de tu archivo.", body: "Desbloquea la <b>transcripción completa</b>, edítala y expórtala en TXT, DOCX, PDF, SRT o CSV.", cta: `Desbloquear ahora — ${today}` },
    { subject: "¿Todavía necesitas tu transcripción?", open: "Tu transcripción sigue esperándote.", body: `Desbloquearla lleva menos de un minuto — ${today} hoy.`, cta: "Abrir mi transcripción" },
    { subject: "⚠️ Tu archivo se borrará en 12 horas", open: "Aviso: para proteger tu privacidad, borramos los archivos subidos automáticamente.", body: "<b>Tu archivo se borrará en unas 12 horas.</b> Desbloquea tu transcripción ahora para conservarla.", cta: `Desbloquear antes de que se borre — ${today}` },
  ][s - 1]!,
  it: (s, today) => [
    { subject: "La tua trascrizione è pronta da sbloccare 🔓", open: "Buone notizie: abbiamo già trascritto l'inizio del tuo file.", body: "Sblocca la <b>trascrizione completa</b>, modificala ed esportala in TXT, DOCX, PDF, SRT o CSV.", cta: `Sblocca ora — ${today}` },
    { subject: "Ti serve ancora la tua trascrizione?", open: "La tua trascrizione ti sta ancora aspettando.", body: `Sbloccarla richiede meno di un minuto — ${today} oggi.`, cta: "Apri la mia trascrizione" },
    { subject: "⚠️ Il tuo file verrà eliminato tra 12 ore", open: "Attenzione: per proteggere la tua privacy, eliminiamo automaticamente i file caricati.", body: "<b>Il tuo file verrà eliminato tra circa 12 ore.</b> Sblocca ora la trascrizione per conservarla.", cta: `Sblocca prima che venga eliminata — ${today}` },
  ][s - 1]!,
  de: (s, today) => [
    { subject: "Ihre Transkription kann freigeschaltet werden 🔓", open: "Gute Nachrichten: Wir haben den Anfang Ihrer Datei bereits transkribiert.", body: "Schalten Sie die <b>vollständige Transkription</b> frei, bearbeiten Sie sie und exportieren Sie sie als TXT, DOCX, PDF, SRT oder CSV.", cta: `Jetzt freischalten — ${today}` },
    { subject: "Brauchen Sie Ihre Transkription noch?", open: "Ihre Transkription wartet noch auf Sie.", body: `Das Freischalten dauert weniger als eine Minute — ${today} heute.`, cta: "Meine Transkription öffnen" },
    { subject: "⚠️ Ihre Datei wird in 12 Stunden gelöscht", open: "Hinweis: Zum Schutz Ihrer Privatsphäre löschen wir hochgeladene Dateien automatisch.", body: "<b>Ihre Datei wird in etwa 12 Stunden gelöscht.</b> Schalten Sie Ihre Transkription jetzt frei, um sie zu behalten.", cta: `Freischalten, bevor sie weg ist — ${today}` },
  ][s - 1]!,
};

function plantilla(stage: number, url: string, locale: string, today: string): { subject: string; html: string } {
  const loc = T[locale] ? locale : "en";
  const p = T[loc](stage, today);
  const btn = `<p style="margin:24px 0"><a href="${url}" style="background:#4f46e5;color:#fff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:700">${p.cta}</a></p>`;
  return { subject: p.subject, html: `<p>${p.open}</p><p>${p.body}</p>${btn}${footer(loc)}` };
}

/** Procesa la cola de recuperación. Devuelve cuántos emails se han enviado. */
export async function runRecovery(): Promise<number> {
  const prisma = await getPrisma();
  const base = process.env.APP_URL || "https://voicetotexts.net";
  let enviados = 0;

  for (const { stage, afterH } of STAGES) {
    const limite = new Date(Date.now() - afterH * 3600e3);
    const lote = await prisma.transcription.findMany({
      where: {
        status: "DONE", locked: true, recoveryStage: stage - 1, createdAt: { lt: limite },
        ...(stage === 3 ? { fileDeleted: false } : {}), // el aviso de borrado solo si aún hay archivo
      },
      include: { user: { select: { email: true, subStatus: true } } },
      take: 50,
    });
    for (const tr of lote) {
      // Marca el stage ANTES de enviar (si el envío falla, no se reintenta en bucle cada tick).
      await prisma.transcription.update({ where: { id: tr.id }, data: { recoveryStage: stage } }).catch(() => {});
      const email = tr.contactEmail || tr.user?.email || null;
      if (!email || email.endsWith("@voice2text.local")) continue;
      const locale = tr.uiLocale || "en";
      const today = precioPara(locale).todayLabel; // moneda según el idioma
      const { subject, html } = plantilla(stage, `${base}/r/${tr.id}`, locale, today);
      if (await sendMail(email, subject, html)) enviados++;
    }
  }
  return enviados;
}
