import { getPrisma } from "../db/client.ts";
import { sendMail } from "./mailer.ts";
import { tieneStripe, getStripe } from "./stripe.ts";
import { tieneKunfupay, cancelSubscription } from "./kunfupay.ts";

/**
 * Agente automático del buzón support@: lee el IMAP propio, detecta solicitudes de
 * cancelación/reembolso y aplica la política:
 *   - Reembolso con cargo < REFUND_WINDOW_HOURS (24h) → refund en Stripe + cancelación inmediata.
 *   - Reembolso > 24h → cancela la renovación (acceso hasta fin de periodo) y lo explica.
 *   - Cancelación → cancela la renovación.
 * Siempre notifica al admin (NOTIFY_EMAIL). Si no entiende el email, no toca nada y lo reenvía.
 */

const REFUND_WINDOW_H = Number(process.env.REFUND_WINDOW_HOURS || 24);

const RE_REFUND = /refund|reembols|devoluci[oó]n|devolver|money\s*back|devuelvan|charge\s*back|dinero/i;
const RE_CANCEL = /cancel|cancelar|baja\b|darme de baja|unsubscribe|stop (my )?subscription|no quiero (pagar|seguir)|end (my )?subscription/i;
const RE_NOREPLY = /mailer-daemon|postmaster|no-?reply|noreply|auto-?reply|bounce/i;

const FOOTER = `<p style="color:#94a3b8;font-size:12px">Voice2Text · 1mmObj LLC · 1209 Mountain Road Pl NE, Ste N, Albuquerque, NM 87110, USA</p>`;

interface Resultado { accion: string; detalle: string }

async function procesarSolicitud(fromEmail: string, subject: string, body: string): Promise<Resultado> {
  const texto = `${subject}\n${body}`.slice(0, 4000);
  const pideRefund = RE_REFUND.test(texto);
  const pideCancel = RE_CANCEL.test(texto) || pideRefund;
  if (!pideCancel) return { accion: "IGNORADO", detalle: "sin intención clara de cancelar/reembolsar" };

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email: fromEmail.toLowerCase() } });
  if (!user) {
    await sendMail(fromEmail, "About your request — Voice2Text",
      `<p>We couldn't find an account under this email address.</p><p>Please write us from the email you used at voicetotexts.net, or reply with that email address.</p>${FOOTER}`);
    return { accion: "SIN_CUENTA", detalle: "el remitente no tiene cuenta" };
  }

  // --- Reembolso dentro de la ventana de 24h ---
  if (pideRefund && user.stripeCustomerId && tieneStripe()) {
    try {
      const stripe = await getStripe();
      const charges = await stripe.charges.list({ customer: user.stripeCustomerId, limit: 5 });
      const cargo = (charges.data || []).find((c: any) => c.status === "succeeded" && !c.refunded);
      if (cargo && (Date.now() / 1000 - cargo.created) < REFUND_WINDOW_H * 3600) {
        await stripe.refunds.create({ charge: cargo.id });
        if (user.stripeSubscriptionId) await stripe.subscriptions.cancel(user.stripeSubscriptionId).catch(() => {});
        await prisma.user.update({ where: { id: user.id }, data: { subStatus: "CANCELED", cancelAtPeriodEnd: false } });
        await sendMail(fromEmail, "Your refund has been issued — Voice2Text",
          `<p>Done! We've refunded your payment of $${(cargo.amount / 100).toFixed(2)} and canceled your subscription.</p><p>The refund usually appears on your card within 5–10 business days.</p>${FOOTER}`);
        return { accion: "REEMBOLSADO", detalle: `refund de $${(cargo.amount / 100).toFixed(2)} (cargo ${cargo.id}) + suscripción cancelada` };
      }
      if (cargo) {
        // Fuera de ventana → cancela renovación y explica la política.
        if (user.stripeSubscriptionId) await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true }).catch(() => {});
        await prisma.user.update({ where: { id: user.id }, data: { cancelAtPeriodEnd: true } });
        await sendMail(fromEmail, "About your refund request — Voice2Text",
          `<p>We've canceled your subscription — you won't be charged again, and you keep access until the end of your current period.</p><p>As per our <a href="https://voicetotexts.net/refund">refund policy</a>, charges older than ${REFUND_WINDOW_H} hours aren't refundable. If you believe there was a billing error, just reply to this email.</p>${FOOTER}`);
        return { accion: "FUERA_DE_VENTANA", detalle: `cargo de hace >${REFUND_WINDOW_H}h → renovación cancelada; revisar si quieres hacer excepción` };
      }
    } catch (e) {
      return { accion: "ERROR_STRIPE", detalle: e instanceof Error ? e.message : "error" };
    }
  }

  // --- Cancelación (o refund sin cargos que reembolsar) ---
  try {
    if (user.stripeSubscriptionId && tieneStripe()) {
      const stripe = await getStripe();
      await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true }).catch(() => {});
    } else if (user.kunfupaySubscriptionId && tieneKunfupay()) {
      await cancelSubscription(user.kunfupaySubscriptionId).catch(() => {});
    }
    await prisma.user.update({ where: { id: user.id }, data: { cancelAtPeriodEnd: true } });
  } catch { /* la BD manda */ }
  await sendMail(fromEmail, "Your subscription has been canceled — Voice2Text",
    `<p>Done! Your subscription is canceled — you won't be charged again.</p><p>You keep access until the end of your current period. You can come back anytime.</p>${FOOTER}`);
  return { accion: "CANCELADO", detalle: "renovación cancelada (acceso hasta fin de periodo)" };
}

/** Lee el buzón support@ (UNSEEN), procesa cada mensaje y devuelve el nº procesados. */
export async function runSupport(): Promise<{ procesados: number; acciones: string[] }> {
  const host = process.env.SUPPORT_IMAP_HOST, user = process.env.SUPPORT_IMAP_USER, pass = process.env.SUPPORT_IMAP_PASS;
  if (!host || !user || !pass) return { procesados: 0, acciones: ["IMAP sin configurar"] };

  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({ host, port: Number(process.env.SUPPORT_IMAP_PORT || 993), secure: true, auth: { user, pass }, logger: false });
  const acciones: string[] = [];
  let procesados = 0;

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const uids = await client.search({ seen: false });
    for (const uid of (uids || []).slice(0, 20)) {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg?.source) continue;
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); // marca ya (sin bucles si algo falla)
      const mail = await simpleParser(msg.source);
      const from = mail.from?.value?.[0]?.address || "";
      const subject = mail.subject || "";
      const body = (mail.text || "").slice(0, 4000);
      procesados++;

      // No procesar autorespuestas/bots ni correos internos.
      if (!from || RE_NOREPLY.test(from) || mail.headers.get("auto-submitted")) { acciones.push(`${from || "?"}: saltado (auto)`); continue; }
      if (from.toLowerCase().endsWith("@voicetotexts.net")) { acciones.push(`${from}: saltado (interno)`); continue; }

      const r = await procesarSolicitud(from, subject, body);
      acciones.push(`${from}: ${r.accion} — ${r.detalle}`);

      // Notifica SIEMPRE al admin con lo hecho (o lo no entendido, para respuesta manual).
      const admin = process.env.NOTIFY_EMAIL;
      if (admin) {
        await sendMail(admin, `🛎️ Soporte auto: ${r.accion} — ${from}`,
          `<p><b>De:</b> ${from}<br/><b>Asunto:</b> ${subject}</p>
           <p><b>Acción:</b> ${r.accion}<br/><b>Detalle:</b> ${r.detalle}</p>
           <p><b>Mensaje original:</b></p><blockquote style="color:#475569;border-left:3px solid #e5e7eb;padding-left:12px">${body.slice(0, 1500).replace(/</g, "&lt;")}</blockquote>
           ${r.accion === "IGNORADO" ? "<p>⚠️ No se ha hecho nada — responde tú al cliente.</p>" : ""}`);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return { procesados, acciones };
}
