import { getPrisma } from "../db/client.ts";
import { sendMail } from "./mailer.ts";
import { formatPrice } from "./locale.ts";

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

const FOOTER = `
  <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#94a3b8;font-size:12px;line-height:1.5">
    You're receiving this because you uploaded a file to voicetotexts.net.<br/>
    Voice2Text · a product of 1mmObj LLC · 1209 Mountain Road Pl NE, Ste N, Albuquerque, NM 87110, USA
  </p>`;

function plantilla(stage: number, url: string, today: string): { subject: string; html: string } {
  const btn = (label: string) => `<p style="margin:24px 0"><a href="${url}" style="background:#4f46e5;color:#fff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:700">${label}</a></p>`;
  if (stage === 1) return {
    subject: "Your transcription is ready to unlock 🔓",
    html: `<p>Good news — we already transcribed the beginning of your file.</p>
           <p>Unlock the <b>full transcription</b>, edit it and download it as TXT, DOCX, PDF, SRT or CSV.</p>
           ${btn(`Unlock now — ${today}`)}${FOOTER}`,
  };
  if (stage === 2) return {
    subject: "Still need your transcription?",
    html: `<p>Your transcription is still waiting for you.</p>
           <p>It takes less than a minute to unlock it — ${today} today.</p>
           ${btn("Open my transcription")}${FOOTER}`,
  };
  return {
    subject: "⚠️ Your file will be deleted in 12 hours",
    html: `<p>Heads up: to protect your privacy, we automatically delete uploaded files.</p>
           <p><b>Your file will be deleted in about 12 hours.</b> Unlock your transcription now to keep it.</p>
           ${btn(`Unlock before it's gone — ${today}`)}${FOOTER}`,
  };
}

/** Procesa la cola de recuperación. Devuelve cuántos emails se han enviado. */
export async function runRecovery(): Promise<number> {
  const prisma = await getPrisma();
  const base = process.env.APP_URL || "https://voicetotexts.net";
  const today = formatPrice(Number(process.env.TRIPWIRE_CENTS || 99), "USD");
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
      const { subject, html } = plantilla(stage, `${base}/r/${tr.id}`, today);
      if (await sendMail(email, subject, html)) enviados++;
    }
  }
  return enviados;
}
