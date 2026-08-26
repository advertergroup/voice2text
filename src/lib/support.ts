import { getPrisma } from "../db/client.ts";
import { sendMail } from "./mailer.ts";
import { tieneStripe, getStripe } from "./stripe.ts";
import { tieneKunfupay, cancelSubscription } from "./kunfupay.ts";
import {
  RE_REFUND, RE_CANCEL, RE_CARGO, limpiarCitas, esAsuntoNuestro, extraerEmails, detectarIdioma, plantillaNoEsNuestro, dmarcDe,
  TEXTOS_AVISO_TITULAR, type ComprobacionEmail,
} from "./support-texto.ts";

/**
 * Agente automático del buzón support@: lee el IMAP propio, detecta solicitudes de
 * cancelación/reembolso (o quejas de cobro) y aplica la política:
 *   - Remitente con suscripción viva (TRIAL/ACTIVE/PAST_DUE):
 *       · reembolso con cargo < REFUND_WINDOW_HOURS (24h) → refund en Stripe + cancelación inmediata;
 *       · reembolso > 24h → cancela la renovación (acceso hasta fin de periodo) y lo explica;
 *       · cancelación → cancela la renovación.
 *     (Con SUPPORT_REQUIRE_DMARC=1 exige dmarc=pass de nuestro MTA; si no, remite al autoservicio /account.)
 *   - Remitente SIN suscripción viva (sin cuenta, cuenta gratis, ya cancelada) y sin cargo real en Stripe →
 *     email explicativo en su idioma: no hay cargo nuestro con SU dirección, que la confirme, y lista de
 *     plataformas con nombre parecido (nos confunden con voice2texts.com). Una vez cada 48h por remitente.
 *   - Nunca se toca ni se revela la cuenta de un email distinto al remitente (ni por lo que se dice ni por
 *     callar): si mencionan una cuenta de pago ajena se avisa al TITULAR a su propio email, y el remitente
 *     recibe exactamente lo mismo que si no la hubiera mencionado.
 *   - Si Stripe tiene dinero cobrado del REMITENTE que la BD no refleja, o Stripe falla → nada automático.
 * Guardas anti-abuso: tope global de respuestas no autenticadas por hora, DMARC fail → manual, listas/bots ignorados.
 * Siempre notifica al admin (NOTIFY_EMAIL) y deja rastro en SupportLog.
 */

const REFUND_WINDOW_H = Number(process.env.REFUND_WINDOW_HOURS || 24);
const REPETIR_H = Number(process.env.SUPPORT_REPEAT_HOURS || 48);
const MAX_POR_HORA = Number(process.env.SUPPORT_MAX_PER_HOUR || 10);
const REQUIERE_DMARC = process.env.SUPPORT_REQUIRE_DMARC === "1";
const APP_URL = process.env.APP_URL || "https://voicetotexts.net";

const RE_NOREPLY = /mailer-daemon|postmaster|no-?reply|noreply|auto-?reply|bounce/i;
/** Acciones que implican un email automático a alguien NO autenticado (cuentan para el tope por hora). */
const ACCIONES_NO_AUTENTICADAS = ["NO_ES_NUESTRO", "AVISO_TITULAR"];
/** Acciones que requieren respuesta manual del admin (además de cualquier *_SIN_EMAIL y de `manual: true`). */
const ACCIONES_MANUALES = ["IGNORADO", "REPETIDO", "REVISAR_PAGO_STRIPE", "CAP_HORARIO", "AUTH_FAIL", "ERROR", "ERROR_STRIPE"];

const FOOTER = `<p style="color:#94a3b8;font-size:12px">Voice2Text · 1mmObj LLC · 1209 Mountain Road Pl NE, Ste N, Albuquerque, NM 87110, USA</p>`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const desde = (horas: number) => new Date(Date.now() - horas * 3600e3);
/** Clave de throttle: sin +etiqueta (a+1@x, a+2@x… caen en el mismo buzón). */
const normalizar = (email: string) => email.toLowerCase().replace(/\+[^@]*@/, "@");

interface Resultado { accion: string; detalle: string; manual?: boolean }

interface UsuarioMin {
  id: string; email: string; subStatus: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null; kunfupaySubscriptionId: string | null;
}

/** Suscripción viva = lo único que autoriza cancelar/reembolsar. Un customer de Stripe sin pagar (checkout abandonado) o una cuenta CANCELED no lo es. */
function suscripcionViva(u: UsuarioMin): boolean {
  return ["TRIAL", "ACTIVE", "PAST_DUE"].includes(u.subStatus);
}

/** Cargo cobrado y no reembolsado en Stripe para ese email (por customer conocido y por búsqueda de email). Lanza si Stripe falla. */
async function cargoStripe(email: string, customerId?: string | null): Promise<{ customerId: string; chargeId: string; amount: number } | null> {
  if (!tieneStripe()) return null;
  const stripe = await getStripe();
  const ids: string[] = customerId ? [customerId] : [];
  const custs = await stripe.customers.list({ email, limit: 3 });
  for (const c of custs.data || []) if (!ids.includes(c.id)) ids.push(c.id);
  for (const id of ids) {
    const ch = await stripe.charges.list({ customer: id, limit: 5 });
    const ok = (ch.data || []).find((x: any) => x.status === "succeeded" && !x.refunded);
    if (ok) return { customerId: id, chargeId: ok.id, amount: ok.amount };
  }
  return null;
}

async function procesarSolicitud(fromEmail: string, subject: string, bodyBruto: string, autenticado: boolean): Promise<Resultado> {
  const remitente = fromEmail.toLowerCase();
  const body = limpiarCitas(bodyBruto);                 // sin lo citado (si no, re-procesaríamos nuestro propio email)
  const asunto = esAsuntoNuestro(subject) ? "" : subject; // «Re: Your subscription has been canceled — Voice2Text» no es una petición
  const texto = `${asunto}\n${body}`.slice(0, 4000);
  const pideRefund = RE_REFUND.test(texto);
  const pideCancel = RE_CANCEL.test(texto) || pideRefund;
  const quejaCargo = RE_CARGO.test(texto);
  if (!pideCancel && !quejaCargo) return { accion: "IGNORADO", detalle: "sin intención clara de cancelar/reembolsar ni queja de cobro" };

  const prisma = await getPrisma();
  const candidatos = extraerEmails(remitente, texto);   // remitente + emails que menciona
  const usuarios: UsuarioMin[] = await prisma.user.findMany({
    where: { email: { in: candidatos } },
    select: { id: true, email: true, subStatus: true, stripeCustomerId: true, stripeSubscriptionId: true, kunfupaySubscriptionId: true },
  });
  const propio = usuarios.find((u) => u.email === remitente) || null;
  const lang = detectarIdioma(texto);

  // ======== Remitente SIN suscripción viva → ¿es nuestro ese cobro? ========
  if (!propio || !suscripcionViva(propio)) {
    // 1) Stripe manda: si hay dinero cobrado del REMITENTE que la BD no refleja, o Stripe falla, nada automático.
    //    Un cargo de un email AJENO no cambia lo que recibe el remitente (si no, el silencio sería un oráculo): solo se anota para el admin.
    let notas = "";
    let manual = false;
    for (const e of candidatos) {
      let cargo: Awaited<ReturnType<typeof cargoStripe>>;
      try { cargo = await cargoStripe(e, usuarios.find((x) => x.email === e)?.stripeCustomerId); }
      catch (err) { return { accion: "ERROR_STRIPE", detalle: `Stripe no respondió al comprobar cargos de ${e} (${err instanceof Error ? err.message : "error"}) — nada automático; responde tú` }; }
      if (!cargo) continue;
      const txt = `Stripe tiene un cargo cobrado ($${(cargo.amount / 100).toFixed(2)}, customer ${cargo.customerId}, charge ${cargo.chargeId}) para ${e}`;
      if (e === remitente) return { accion: "REVISAR_PAGO_STRIPE", detalle: `${txt} pero no tiene suscripción viva en la BD — revisar a mano` };
      notas += ` · ${txt} (email ajeno mencionado) — revisar a mano`;
      manual = true;
    }

    // 2) Una explicación cada 48h por remitente, y tope global por hora para todo envío no autenticado.
    const clave = normalizar(remitente);
    const previo = await prisma.supportLog.findFirst({ where: { email: clave, accion: "NO_ES_NUESTRO", createdAt: { gte: desde(REPETIR_H) } }, orderBy: { createdAt: "desc" } });
    if (previo) {
      const h = Math.round((Date.now() - previo.createdAt.getTime()) / 3600e3);
      return { accion: "REPETIDO", detalle: `hace ${h}h ya se le explicó que no tiene suscripción ni cargo con nosotros — responde tú${notas}` };
    }
    const enLaUltimaHora = await prisma.supportLog.count({ where: { accion: { in: ACCIONES_NO_AUTENTICADAS }, createdAt: { gte: desde(1) } } });
    if (enLaUltimaHora >= MAX_POR_HORA) {
      return { accion: "CAP_HORARIO", detalle: `${enLaUltimaHora} respuestas automáticas en la última hora (tope ${MAX_POR_HORA}) — posible abuso; responde tú${notas}` };
    }

    // 3) Menciona la cuenta de pago de OTRO email → se avisa al titular (a su propio email; el remitente no sabe nada).
    const ajeno = usuarios.find((u) => u.email !== remitente && suscripcionViva(u));
    if (ajeno) {
      const yaAvisado = await prisma.supportLog.findFirst({ where: { email: ajeno.email, accion: "AVISO_TITULAR", createdAt: { gte: desde(REPETIR_H) } } });
      if (yaAvisado) notas += ` · menciona la cuenta de pago ${ajeno.email} (titular ya avisado hace <${REPETIR_H}h)`;
      else {
        const t = TEXTOS_AVISO_TITULAR[lang] || TEXTOS_AVISO_TITULAR.en;
        const ok = await sendMail(ajeno.email, t.subject, `<p>${esc(t.body).replace("{email}", `<b>${esc(remitente)}</b>`)}</p>${FOOTER}`);
        await prisma.supportLog.create({ data: { email: ajeno.email, subject: "(aviso al titular)", accion: ok ? "AVISO_TITULAR" : "AVISO_TITULAR_SIN_EMAIL", detalle: `alguien pidió cancelar su suscripción desde ${remitente}` } });
        notas += ` · menciona la cuenta de pago ${ajeno.email} → aviso de seguridad al titular ${ok ? "enviado" : "NO enviado (fallo del mailer)"}`;
      }
    }

    // 4) Explicación al remitente, solo sobre SU dirección.
    const estado: ComprobacionEmail["estado"] = !propio ? "sin_cuenta" : propio.subStatus === "CANCELED" ? "cancelada" : "cuenta_gratis";
    const { subject: asuntoResp, html } = plantillaNoEsNuestro(lang, [{ email: remitente, estado }], remitente);
    const enviado = await sendMail(fromEmail, asuntoResp, html + FOOTER);
    const otros = candidatos.filter((e) => e !== remitente);
    return {
      accion: enviado ? "NO_ES_NUESTRO" : "NO_ES_NUESTRO_SIN_EMAIL",
      manual,
      detalle: `remitente ${remitente} (${estado})${otros.length ? `, menciona ${otros.join(", ")}` : ""} · idioma ${lang} → email explicativo ${enviado ? "enviado" : "NO enviado (fallo del mailer)"}${notas}`,
    };
  }

  // ======== Remitente con suscripción viva ========
  const user = propio;
  if (!pideCancel) return { accion: "IGNORADO", detalle: "cliente con suscripción viva pregunta por un cobro sin pedir cancelar — responde tú" };
  if (REQUIERE_DMARC && !autenticado) {
    // Sin dmarc=pass de nuestro MTA no se toca la suscripción por email: se le remite al autoservicio (el email va al dueño real del buzón).
    const url = `${APP_URL}/${lang === "es" ? "" : "en/"}account`;
    const html = lang === "es"
      ? `<p>Hemos recibido tu solicitud, pero no hemos podido verificar automáticamente el remitente de este email.</p><p>Puedes cancelar tu suscripción al instante desde tu cuenta: <a href="${url}">${url}</a>. Si prefieres que lo hagamos nosotros, responde a este email y nos encargamos.</p>`
      : `<p>We received your request, but we couldn't automatically verify the sender of this email.</p><p>You can cancel your subscription instantly from your account page: <a href="${url}">${url}</a>. If you'd rather we do it for you, just reply to this email and we'll take care of it.</p>`;
    const ok = await sendMail(fromEmail, lang === "es" ? "Sobre tu solicitud — Voice2Text" : "About your request — Voice2Text", html + FOOTER);
    return { accion: "AUTH_FAIL", detalle: `suscripción viva pero el email no trae dmarc=pass de nuestro MTA (dominio sin DMARC o suplantación) — nada automático; remitido al autoservicio /account (email ${ok ? "enviado" : "NO enviado"}); responde tú si procede` };
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
        const ok = await sendMail(fromEmail, "Your refund has been issued — Voice2Text",
          `<p>Done! We've refunded your payment of $${(cargo.amount / 100).toFixed(2)} and canceled your subscription.</p><p>The refund usually appears on your card within 5–10 business days.</p>${FOOTER}`);
        return { accion: ok ? "REEMBOLSADO" : "REEMBOLSADO_SIN_EMAIL", detalle: `refund de $${(cargo.amount / 100).toFixed(2)} (cargo ${cargo.id}) + suscripción cancelada${ok ? "" : " — YA HECHO en Stripe pero el email al cliente NO salió: avísale tú"}` };
      }
      if (cargo) {
        // Fuera de ventana → cancela renovación y explica la política.
        if (user.stripeSubscriptionId) await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true }).catch(() => {});
        await prisma.user.update({ where: { id: user.id }, data: { cancelAtPeriodEnd: true } });
        const ok = await sendMail(fromEmail, "About your refund request — Voice2Text",
          `<p>We've canceled your subscription — you won't be charged again, and you keep access until the end of your current period.</p><p>As per our <a href="https://voicetotexts.net/refund">refund policy</a>, charges older than ${REFUND_WINDOW_H} hours aren't refundable. If you believe there was a billing error, just reply to this email.</p>${FOOTER}`);
        return { accion: ok ? "FUERA_DE_VENTANA" : "FUERA_DE_VENTANA_SIN_EMAIL", detalle: `cargo de hace >${REFUND_WINDOW_H}h → renovación cancelada; revisar si quieres hacer excepción${ok ? "" : " — el email al cliente NO salió: avísale tú"}` };
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
  const ok = await sendMail(fromEmail, "Your subscription has been canceled — Voice2Text",
    `<p>Done! Your subscription is canceled — you won't be charged again.</p><p>You keep access until the end of your current period. You can come back anytime.</p>${FOOTER}`);
  return { accion: ok ? "CANCELADO" : "CANCELADO_SIN_EMAIL", detalle: `renovación cancelada (acceso hasta fin de periodo)${ok ? "" : " — YA HECHO pero el email al cliente NO salió: avísale tú"}` };
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

      // No procesar autorespuestas, bots, listas ni correos internos.
      const autoSubmitted = String(mail.headers.get("auto-submitted") || "");
      const precedence = String(mail.headers.get("precedence") || "");
      const esAuto = (autoSubmitted && !/^no$/i.test(autoSubmitted)) || !!mail.headers.get("list-id") || !!mail.headers.get("list-unsubscribe") || /bulk|list|auto/i.test(precedence);
      if (!from || RE_NOREPLY.test(from) || esAuto) { acciones.push(`${from || "?"}: saltado (auto)`); continue; }
      if (from.toLowerCase().endsWith("@voicetotexts.net")) { acciones.push(`${from}: saltado (interno)`); continue; }

      let r: Resultado;
      const dmarc = dmarcDe(mail.headers as { get(k: string): unknown }, process.env.SUPPORT_AUTHSERV_ID || process.env.SUPPORT_IMAP_HOST || "mail.voicetotexts.net");
      if (dmarc === "fail") r = { accion: "AUTH_FAIL", detalle: `DMARC fail para ${from} (posible suplantación) — nada automático; responde tú si procede` };
      else {
        try { r = await procesarSolicitud(from, subject, body, dmarc === "pass"); }
        catch (e) { r = { accion: "ERROR", detalle: e instanceof Error ? e.message : "error" }; }
      }
      acciones.push(`${from}: ${r.accion} — ${r.detalle}`);

      try {
        const prisma = await getPrisma();
        await prisma.supportLog.create({ data: { email: normalizar(from), subject: subject.slice(0, 200), accion: r.accion, detalle: r.detalle.slice(0, 1000) } });
      } catch (e) { console.warn("[support] log", e instanceof Error ? e.message : e); }

      // Notifica SIEMPRE al admin con lo hecho (o lo no entendido, para respuesta manual).
      const admin = process.env.NOTIFY_EMAIL;
      if (admin) {
        const manual = ACCIONES_MANUALES.includes(r.accion) || r.accion.endsWith("_SIN_EMAIL") || !!r.manual;
        await sendMail(admin, `🛎️ Soporte auto: ${r.accion} — ${from}`,
          `<p><b>De:</b> ${esc(from)}<br/><b>Asunto:</b> ${esc(subject)}<br/><b>DMARC (nuestro MTA):</b> ${dmarc}</p>
           <p><b>Acción:</b> ${r.accion}<br/><b>Detalle:</b> ${esc(r.detalle)}</p>
           <p><b>Mensaje original:</b></p><blockquote style="color:#475569;border-left:3px solid #e5e7eb;padding-left:12px">${esc(body.slice(0, 1500))}</blockquote>
           ${manual ? "<p>⚠️ Requiere tu revisión (no se ha respondido al cliente, o la acción ya está hecha pero el email no salió, o hay algo que mirar en Stripe).</p>" : ""}`);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return { procesados, acciones };
}
