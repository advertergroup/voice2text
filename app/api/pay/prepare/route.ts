import { NextResponse } from "next/server";
import { tieneStripe, getStripe } from "../../../../src/lib/stripe.ts";

export const runtime = "nodejs";

/** Asocia email + cliente al PaymentIntent y marca la tarjeta para reutilizar (suscripción posterior). */
export async function POST(req: Request) {
  if (!tieneStripe()) return NextResponse.json({ ok: false }, { status: 400 });
  const { paymentIntentId, email } = await req.json().catch(() => ({}));
  if (!paymentIntentId || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
  if (!pi || pi.status === "succeeded") return NextResponse.json({ ok: false }, { status: 404 });

  let customerId = pi.customer as string | null;
  if (!customerId) {
    const cust = await stripe.customers.create({ email: email.toLowerCase() });
    customerId = cust.id;
  } else {
    await stripe.customers.update(customerId, { email: email.toLowerCase() }).catch(() => {});
  }
  await stripe.paymentIntents.update(paymentIntentId, {
    customer: customerId,
    receipt_email: email.toLowerCase(),
    setup_future_usage: "off_session",
    metadata: { ...(pi.metadata || {}), email: email.toLowerCase() },
  });
  return NextResponse.json({ ok: true });
}
