import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";
import { tieneStripe, getStripe } from "../../../../src/lib/stripe.ts";
import { unlockUser } from "../../../../src/lib/funnel.ts";

export const runtime = "nodejs";

/** Pasa de la prueba de 7 días al plan mensual YA: termina el trial de Stripe (cobra $49.99 con la tarjeta guardada). */
export async function GET(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", base), { status: 303 });
  if (user.subStatus !== "TRIAL") return NextResponse.redirect(new URL("/account", base), { status: 303 });
  const prisma = await getPrisma();

  try {
    if (user.stripeSubscriptionId && tieneStripe()) {
      const stripe = await getStripe();
      // Fin de la prueba ahora → Stripe factura el mes completo con el método de pago guardado.
      await stripe.subscriptions.update(user.stripeSubscriptionId, { trial_end: "now", proration_behavior: "none" });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { subStatus: "ACTIVE", planKey: "premium", trialEndsAt: null, currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
    });
    await unlockUser(user.id);
    return NextResponse.redirect(new URL("/dashboard?upgraded=1", base), { status: 303 });
  } catch {
    return NextResponse.redirect(new URL("/account?error=upgrade", base), { status: 303 });
  }
}
