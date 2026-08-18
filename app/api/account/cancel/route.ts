import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";
import { tieneStripe, getStripe } from "../../../../src/lib/stripe.ts";
import { tieneKunfupay, cancelSubscription } from "../../../../src/lib/kunfupay.ts";

export const runtime = "nodejs";

/** El usuario cancela su suscripción: deja de renovarse; mantiene acceso hasta el fin del periodo pagado. */
export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", base), { status: 303 });
  const prisma = await getPrisma();

  try {
    if (user.stripeSubscriptionId && tieneStripe()) {
      const stripe = await getStripe();
      await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    } else if (user.kunfupaySubscriptionId && tieneKunfupay()) {
      await cancelSubscription(user.kunfupaySubscriptionId);
    }
    await prisma.user.update({ where: { id: user.id }, data: { cancelAtPeriodEnd: true } });
    return NextResponse.redirect(new URL("/account?canceled=1", base), { status: 303 });
  } catch {
    return NextResponse.redirect(new URL("/account?error=cancel", base), { status: 303 });
  }
}
