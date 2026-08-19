/**
 * Envío de emails. Prioridad:
 *  1) Resend (RESEND_API_KEY + RESEND_FROM) — mejor entregabilidad para los emails a clientes.
 *  2) SMTP propio (mail.voicetotexts.net) — fallback y avisos internos.
 * Sin nada configurado, los envíos se omiten en silencio (no rompen el flujo).
 */

export function tieneSmtp(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function tieneResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM || "Voice2Text <support@voicetotexts.net>", to: [to], subject, html }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { console.warn("[mailer] resend", r.status, (await r.text()).slice(0, 200)); return false; }
    return true;
  } catch (e) {
    console.warn("[mailer] resend error", e instanceof Error ? e.message : e);
    return false;
  }
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
  // Resend primero (si está configurado); si falla o no está, SMTP propio.
  if (tieneResend() && await sendViaResend(to, subject, html)) return true;
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
