import { NextResponse } from "next/server";
import { getPrisma } from "../../../src/db/client.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { tieneStripe, getStripe } from "../../../src/lib/stripe.ts";
import { activeProvider, tieneKunfupay, createSubscriptionSession } from "../../../src/lib/kunfupay.ts";
import { unlockUser } from "../../../src/lib/funnel.ts";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/register", base), { status: 303 });
  const planKey = new URL(req.url).searchParams.get("plan") || "premium";
  const prisma = await getPrisma();
  const plan = await prisma.plan.findFirst({ where: { key: planKey, locale: "es" } });
  if (!plan) return NextResponse.redirect(new URL("/pricing", base), { status: 303 });

  const provider = activeProvider();
  const okUrl = new URL("/dashboard?paid=1", base).toString();
  const cancelUrl = new URL("/pricing", base).toString();
  const configError = () => NextResponse.redirect(new URL("/pricing?error=config", base), { status: 303 });

  // ---- Kunfupay: crea una sesión de suscripción y redirige al checkout ----
  if (provider === "kunfupay") {
    if (!(tieneKunfupay() && process.env.KUNFUPAY_PRODUCT_ID && plan.kunfupayPlanId)) return configError();
    try {
      const session = await createSubscriptionSession({
        productId: process.env.KUNFUPAY_PRODUCT_ID,
        paymentPlanId: plan.kunfupayPlanId,
        customerId: user.id,                 // = nuestro user.id → llega en los webhooks
        customerEmail: user.email,
        externalReference: user.id,
        successUrl: okUrl,
        cancelUrl,
        metadata: { userId: user.id, planKey: plan.key },
      });
      await prisma.user.update({ where: { id: user.id }, data: { kunfupaySessionId: session.id, planKey: plan.key } }).catch(() => {});
      return NextResponse.redirect(session.checkoutUrl, { status: 303 });
    } catch {
      return NextResponse.redirect(new URL(`/pricing?error=pago`, base), { status: 303 });
    }
  }

  // ---- Stripe ----
  if (provider === "stripe") {
    if (!(tieneStripe() && plan.stripePriceId)) return configError();
    try {
      const stripe = await getStripe();
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const cust = await stripe.customers.create({ email: user.email, name: user.nombre || undefined });
        customerId = cust.id;
        await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
      }
      const trialDays = Number(process.env.TRIAL_DAYS || 7);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        subscription_data: trialDays > 0 ? { trial_period_days: trialDays } : undefined,
        success_url: okUrl,
        cancel_url: cancelUrl,
        metadata: { userId: user.id, planKey: plan.key },
      });
      return NextResponse.redirect(session.url!, { status: 303 });
    } catch {
      return NextResponse.redirect(new URL("/pricing?error=pago", base), { status: 303 });
    }
  }

  // ---- provider === "mock" (SOLO): activación de prueba para el funnel sin pasarela.
  // Nunca se llega aquí con una pasarela real activa → no se regala acceso de pago.
  await prisma.user.update({
    where: { id: user.id },
    data: { subStatus: plan.periodo === "trial" ? "TRIAL" : "ACTIVE", planKey: plan.key,
      trialEndsAt: plan.periodo === "trial" ? new Date(Date.now() + 7 * 864e5) : null,
      currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
  });
  await unlockUser(user.id); // transcribe el resto de sus transcripciones bloqueadas
  return NextResponse.redirect(new URL("/dashboard?activated=1", base), { status: 303 });
}
