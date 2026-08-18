/**
 * Envío de emails por el servidor de correo propio (mail.voicetotexts.net).
 * Env: SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, NOTIFY_EMAIL (avisos al admin).
 * Sin SMTP configurado, los envíos se omiten en silencio (no rompen el flujo).
 */

export function tieneSmtp(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tx: any = null;
async function getTransport() {
  if (_tx) return _tx;
  const nodemailer = (await import("nodemailer")).default;
  _tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,               // 587 STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false }, // cert del propio dominio
  });
  return _tx;
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!tieneSmtp()) return false;
  try {
    const tx = await getTransport();
    await tx.sendMail({ from: `Voice2Text <${process.env.SMTP_USER}>`, to, subject, html });
    return true;
  } catch (e) {
    console.warn("[mailer] fallo enviando a", to, e instanceof Error ? e.message : e);
    return false;
  }
}

/** Aviso al admin (NOTIFY_EMAIL) de una nueva transcripción manual pendiente. */
export async function notifyManualJob(tr: { id: string; sourceUrl?: string | null; titulo: string; language: string }): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return;
  const base = process.env.APP_URL || "https://voicetotexts.net";
  await sendMail(
    to,
    `⏳ Nueva transcripción MANUAL pendiente — ${tr.titulo.slice(0, 60)}`,
    `<p>Hay una nueva URL pendiente de procesado manual (promesa: &lt;24h).</p>
     <ul>
       <li><b>URL:</b> <a href="${tr.sourceUrl || "#"}">${tr.sourceUrl || tr.titulo}</a></li>
       <li><b>Idioma:</b> ${tr.language}</li>
       <li><b>ID:</b> ${tr.id}</li>
     </ul>
     <p>1) Descarga el audio/vídeo de esa URL.<br/>2) Súbelo en la cola manual: <a href="${base}/admin/manual">${base}/admin/manual</a></p>`
  );
}
