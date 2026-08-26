import { getPrisma } from "../db/client.ts";
import { sendMail } from "./mailer.ts";
import { tieneStripe, getStripe } from "./stripe.ts";
import { tieneKunfupay, cancelSubscription } from "./kunfupay.ts";
import {
  RE_REFUND, RE_CANCEL, RE_CARGO, limpiarCitas, extraerEmails, detectarIdioma, plantillaNoEsNuestro,
  TEXTOS_OTRO_EMAIL, type ComprobacionEmail,
} from "./support-texto.ts";

/**
 * Agente automático del buzón support@: lee el IMAP propio, detecta solicitudes de
 * cancelación/reembolso (o consultas de cobro) y aplica la política:
 *   - Reembolso con cargo < REFUND_WINDOW_HOURS (24h) → refund en Stripe + cancelación inmediata.
 *   - Reembolso > 24h → cancela la renovación (acceso hasta fin de periodo) y lo explica.
 *   - Cancelación → cancela la renovación.
 *   - Sin cuenta de pago (ni cuenta, o cuenta gratis, o ya cancelada) y sin cargo en Stripe →
 *     email explicativo en su idioma: no hay cargo nuestro con ese email, que lo confirme, y lista de
 *     plataformas con nombre parecido (la gente nos confunde con voice2texts.com). Una vez cada 48h.
 * Siempre notifica al admin (NOTIFY_EMAIL) y deja rastro en SupportLog. Si no entiende el email, no toca nada.
 */

const REFUND_WINDOW_H = Number(process.env.REFUND_WINDOW_HOURS || 24);
const REPETIR_H = Number(process.env.SUPPORT_REPEAT_HOURS || 48);

const RE_NOREPLY = /mailer-daemon|postmaster|no-?reply|noreply|auto-?reply|bounce/i;

const FOOTER = `<p style="color:#94a3b8;font-size:12px">Voice2Text · 1mmObj LLC · 1209 Mountain Road Pl NE, Ste N, Albuquerque, NM 87110, USA</p>`;

interface Resultado { accion: string; detalle: string }

interface UsuarioMin {
  id: string; email: string; subStatus: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null; kunfupaySubscriptionId: string | null;
}

/** Tiene (o tuvo) algo de pago con nosotros: suscripción viva o cliente Stripe conocido. */
function tieneHistorialPago(u: UsuarioMin): boolean {
  return ["TRIAL", "ACTIVE", "PAST_DUE"].includes(u.subStatus) || !!u.stripeSubscriptionId || !!u.kunfupaySubscriptionId || !!u.stripeCustomerId;
}

/** Cargo cobrado en Stripe para cualquier customer con ese email (por si la BD no lo refleja). */
async function cargoStripePorEmail(email: string): Promise<{ customerId: string; chargeId: string; amount: number } | null> {
  if (!tieneStripe()) return null;
  const stripe = await getStripe();
  const custs = await stripe.customers.list({ email, limit: 3 });
  for (const c of custs.data || []) {
    const ch = await stripe.charges.list({ customer: c.id, limit: 5 });
    const ok = (ch.data || []).find((x: any) => x.status === "succeeded");
    if (ok) return { customerId: c.id, chargeId: ok.id, amount: ok.amount };
  }
  return null;
}

async function procesarSolicitud(fromEmail: string, subject: string, bodyBruto: string): Promise<Resultado> {
  const remitente = fromEmail.toLowerCase();
  const body = limpiarCitas(bodyBruto);                 // sin lo citado (si no, re-procesaríamos nuestro propio email)
  const texto = `${subject}\n${body}`.slice(0, 4000);
  const pideRefund = RE_REFUND.test(texto);
  const pideCancel = RE_CANCEL.test(texto) || pideRefund;
  const preguntaCargo = RE_CARGO.test(texto);
  if (!pideCancel && !preguntaCargo) return { accion: "IGNORADO", detalle: "sin intención clara de cancelar/reembolsar ni consulta de cobro" };

  const prisma = await getPrisma();
  const candidatos = extraerEmails(remitente, texto);   // remitente + emails que menciona
  const usuarios: UsuarioMin[] = await prisma.user.findMany({
    where: { email: { in: candidatos } },
    select: { id: true, email: true, subStatus: true, stripeCustomerId: true, stripeSubscriptionId: true, kunfupaySubscriptionId: true },
  });
  const propio = usuarios.find((u) => u.email === remitente) || null;

  // --- ¿Hay una cuenta de pago? Solo actuamos sobre la del REMITENTE (nadie cancela la de otro mencionando su email). ---
  if (!propio || !tieneHistorialPago(propio)) {
    const ajeno = usuarios.find((u) => u.email !== remitente && tieneHistorialPago(u));
    if (ajeno) {
      const lang = detectarIdioma(texto);
      const t = TEXTOS_OTRO_EMAIL[lang] || TEXTOS_OTRO_EMAIL.en;
      await sendMail(fromEmail, t.subject, `<p>${t.body.replace("{email}", `<b>${ajeno.email}</b>`)}</p>${FOOTER}`);
      return { accion: "CUENTA_DE_OTRO_EMAIL", detalle: `la cuenta de pago está bajo ${ajeno.email}, no bajo el remitente → pedido que escriba desde ese email (seguridad)` };
    }

    // Por si hay dinero cobrado en Stripe que la BD no refleja: no se automatiza, aviso al admin.
    for (const e of candidatos) {
      if (usuarios.find((u) => u.email === e)?.stripeCustomerId) continue;
      const cargo = await cargoStripePorEmail(e).catch(() => null);
      if (cargo) return { accion: "REVISAR_PAGO_STRIPE", detalle: `Stripe tiene un cargo cobrado ($${(cargo.amount / 100).toFixed(2)}, customer ${cargo.customerId}, charge ${cargo.chargeId}) para ${e} y la BD no lo refleja — revisar a mano` };
    }

    // --- NO ES NUESTRO: ni cuenta de pago ni cargo. Explicación (en su idioma) + lista de plataformas parecidas. ---
    const comprobaciones: ComprobacionEmail[] = candidatos.map((e) => {
      const u = usuarios.find((x) => x.email === e);
      if (!u) return { email: e, estado: "sin_cuenta" };
      if (u.subStatus === "CANCELED") return { email: e, estado: "cancelada" };
      return { email: e, estado: "cuenta_gratis" };
    });
    const previo = await prisma.supportLog.findFirst({
      where: { email: remitente, accion: "NO_ES_NUESTRO", createdAt: { gte: new Date(Date.now() - REPETIR_H * 3600e3) } },
      orderBy: { createdAt: "desc" },
    });
    if (previo) {
      const h = Math.round((Date.now() - previo.createdAt.getTime()) / 3600e3);
      return { accion: "REPETIDO", detalle: `hace ${h}h ya se le explicó que no tiene cuenta de pago ni cargo con nosotros (${candidatos.join(", ")}) — responde tú` };
    }
    const lang = detectarIdioma(texto);
    const { subject: asunto, html } = plantillaNoEsNuestro(lang, comprobaciones, remitente);
    const enviado = await sendMail(fromEmail, asunto, html + FOOTER);
    return {
      accion: "NO_ES_NUESTRO",
      detalle: `sin suscripción ni cargo para ${comprobaciones.map((c) => `${c.email} (${c.estado})`).join(", ")} · idioma ${lang} → email explicativo ${enviado ? "enviado" : "NO enviado (fallo del mailer)"}`,
    };
  }

  const user = propio;
  if (!pideCancel) return { accion: "IGNORADO", detalle: "cliente de pago pregunta por un cobro sin pedir cancelar — responde tú" };

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
      if (!msg || !msg.source) continue;
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); // marca ya (sin bucles si algo falla)
      const mail = await simpleParser(msg.source);
      const from = mail.from?.value?.[0]?.address || "";
      const subject = mail.subject || "";
      const body = (mail.text || "").slice(0, 6000);
      procesados++;

      // No procesar autorespuestas/bots ni correos internos.
      if (!from || RE_NOREPLY.test(from) || mail.headers.get("auto-submitted")) { acciones.push(`${from || "?"}: saltado (auto)`); continue; }
      if (from.toLowerCase().endsWith("@voicetotexts.net")) { acciones.push(`${from}: saltado (interno)`); continue; }

      let r: Resultado;
      try { r = await procesarSolicitud(from, subject, body); }
      catch (e) { r = { accion: "ERROR", detalle: e instanceof Error ? e.message : "error" }; }
      acciones.push(`${from}: ${r.accion} — ${r.detalle}`);

      try {
        const prisma = await getPrisma();
        await prisma.supportLog.create({ data: { email: from.toLowerCase(), subject: subject.slice(0, 200), accion: r.accion, detalle: r.detalle.slice(0, 1000) } });
      } catch (e) { console.warn("[support] log", e instanceof Error ? e.message : e); }

      // Notifica SIEMPRE al admin con lo hecho (o lo no entendido, para respuesta manual).
      const admin = process.env.NOTIFY_EMAIL;
      if (admin) {
        const manual = ["IGNORADO", "REPETIDO", "REVISAR_PAGO_STRIPE", "ERROR", "ERROR_STRIPE"].includes(r.accion);
        await sendMail(admin, `🛎️ Soporte auto: ${r.accion} — ${from}`,
          `<p><b>De:</b> ${from}<br/><b>Asunto:</b> ${subject.replace(/</g, "&lt;")}</p>
           <p><b>Acción:</b> ${r.accion}<br/><b>Detalle:</b> ${r.detalle.replace(/</g, "&lt;")}</p>
           <p><b>Mensaje original:</b></p><blockquote style="color:#475569;border-left:3px solid #e5e7eb;padding-left:12px">${body.slice(0, 1500).replace(/</g, "&lt;")}</blockquote>
           ${manual ? "<p>⚠️ No se ha respondido al cliente — responde tú.</p>" : ""}`);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return { procesados, acciones };
}
