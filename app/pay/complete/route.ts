import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "../../../src/db/client.ts";
import { tieneStripe, getStripe } from "../../../src/lib/stripe.ts";
import { SESSION_COOKIE, signSession, hashPassword } from "../../../src/auth/core.ts";
import { ANON_COOKIE, unlockUser } from "../../../src/lib/funnel.ts";
import { registrarEvento } from "../../../src/lib/eventos.ts";
import { parseAttr } from "../../../src/lib/attr.ts";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);

/** Return URL de Stripe tras el cobro de hoy: crea suscripción (prueba) + cuenta + sesión + desbloqueo. */
export async function GET(req: Request) {
  const base = process.env.APP_URL || req.url;
  const url = new URL(req.url);
  const piId = url.searchParams.get("payment_intent");
  const tId = url.searchParams.get("t") || "";
  const fail = (code: string) => NextResponse.redirect(new URL(`/pay?t=${encodeURIComponent(tId)}&error=${code}`, base), { status: 303 });

  if (!tieneStripe() || !piId) return fail("nopay");
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId).catch(() => null);
  if (!pi || pi.status !== "succeeded") return fail("nopay");

  const email = (pi.metadata?.email || (pi.receipt_email as string) || "").toLowerCase();
  const anonSession = pi.metadata?.anonSession || "";
  const transcriptionId = pi.metadata?.transcriptionId || tId;
  const customerId = pi.customer as string;
  const pmId = pi.payment_method as string;
  if (!email || !customerId) return fail("nopay");

  const prisma = await getPrisma();

  // Cuenta: reutiliza si el email ya existe; si no, la crea (contraseña aleatoria; sin paso de registro).
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, passwordHash: hashPassword(randomUUID()), role: "USER" } });
  }

  // Suscripción con prueba (idempotente: si ya tiene una activa, no crea otra).
  const yaTiene = user.stripeSubscriptionId && (user.subStatus === "TRIAL" || user.subStatus === "ACTIVE");
  if (!yaTiene) {
    try {
      // La tarjeta usada hoy queda como predeterminada para el cobro tras la prueba.
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } }).catch(() => {});
      const plan = await prisma.plan.findFirst({ where: { key: "premium", locale: "es" } });
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: plan?.stripePriceId! }],
        trial_period_days: TRIAL_DAYS,
        default_payment_method: pmId,
        metadata: { userId: user.id },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { subStatus: "TRIAL", planKey: "premium", stripeCustomerId: customerId, stripeSubscriptionId: sub.id,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date(Date.now() + TRIAL_DAYS * 864e5) },
      });
    } catch {
      // Cobro hecho pero fallo al crear la suscripción → deja acceso igualmente (soporte lo revisa).
      await prisma.user.update({ where: { id: user.id }, data: { subStatus: "TRIAL", planKey: "premium", stripeCustomerId: customerId, currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 864e5) } }).catch(() => {});
    }
  }

  // Atribución de primer toque en el usuario (solo si aún no la tiene): de aquí
  // salen ingresos/suscripciones por campaña y keyword en /admin/ads.
  try {
    const attr = parseAttr((await cookies()).get("v2t_attr")?.value);
    if (attr.source && !user.utmSource) {
      await prisma.user.update({ where: { id: user.id }, data: { utmSource: attr.source, utmCampaign: attr.campaign, utmTerm: attr.term, utmContent: attr.content } });
    }
  } catch { /* la atribución nunca rompe el pago */ }

  // Analítica: compra registrada una sola vez por PaymentIntent (la página puede recargarse).
  try {
    const prisma2 = await getPrisma();
    const ya = await prisma2.evento.findFirst({ where: { tipo: "purchase", meta: pi.id } });
    if (!ya) {
      const jar2 = await cookies();
      await registrarEvento({
        tipo: "purchase", meta: pi.id, valorCent: pi.amount, userId: user.id, trId: transcriptionId || null,
        vid: jar2.get("v2t_vid")?.value, origen: jar2.get("v2t_src")?.value,
        path: pi.metadata?.offerAccepted === "1" ? "/pay(oferta)" : "/pay",
      });
    }
  } catch { /* la analítica nunca rompe el pago */ }

  // Reclama la transcripción anónima y desbloquea el resto.
  if (anonSession) await prisma.transcription.updateMany({ where: { anonSession }, data: { userId: user.id, anonSession: null } }).catch(() => {});
  await unlockUser(user.id);

  // Aterriza en /thanks (página de conversión para Google Ads) y de ahí sigue a la transcripción.
  const dest = transcriptionId ? `/thanks?t=${encodeURIComponent(transcriptionId)}` : "/thanks";
  const res = NextResponse.redirect(new URL(dest, base), { status: 303 });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  const anonCookie = (await cookies()).get(ANON_COOKIE)?.value;
  if (anonCookie) res.cookies.set(ANON_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
