import { NextResponse } from "next/server";
import { getPrisma } from "../../../src/db/client.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { tieneStripe, getStripe } from "../../../src/lib/stripe.ts";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/register", base), { status: 303 });
  const planKey = new URL(req.url).searchParams.get("plan") || "premium";
  const prisma = await getPrisma();
  const plan = await prisma.plan.findFirst({ where: { key: planKey, locale: "es" } });
  if (!plan) return NextResponse.redirect(new URL("/pricing", base), { status: 303 });

  // Sin Stripe configurado → activación mock (para probar el funnel sin claves).
  if (!tieneStripe() || !plan.stripePriceId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { subStatus: plan.periodo === "trial" ? "TRIAL" : "ACTIVE", planKey: plan.key,
        trialEndsAt: plan.periodo === "trial" ? new Date(Date.now() + 7 * 864e5) : null,
        currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
    });
    return NextResponse.redirect(new URL("/dashboard?activated=1", base), { status: 303 });
  }

  // Con Stripe → sesión de checkout de suscripción.
  const stripe = await getStripe();
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const cust = await stripe.customers.create({ email: user.email, name: user.nombre || undefined });
    customerId = cust.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/dashboard?paid=1`,
    cancel_url: `${process.env.APP_URL}/pricing`,
    metadata: { userId: user.id, planKey: plan.key },
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
