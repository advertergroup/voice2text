import { NextResponse } from "next/server";
import { tieneStripe, getStripe } from "../../../../src/lib/stripe.ts";
import { loadContent } from "../../../../src/lib/content.ts";
import { formatPrice } from "../../../../src/lib/locale.ts";

export const runtime = "nodejs";
const TRIPWIRE_CENTS = Number(process.env.TRIPWIRE_CENTS || 99);

/** Aplica la oferta de salida: baja el importe del PaymentIntent al precio de oferta (leído del servidor). */
export async function POST(req: Request) {
  if (!tieneStripe()) return NextResponse.json({ ok: false }, { status: 400 });
  const { paymentIntentId } = await req.json().catch(() => ({}));
  if (!paymentIntentId) return NextResponse.json({ ok: false }, { status: 400 });

  const c = await loadContent("es"); // precio/activación no son localizados
  const enabled = c["exitoffer.enabled"] === "1";
  const price = parseInt(c["exitoffer.price"] || "0", 10);
  if (!enabled || !(price > 0 && price < TRIPWIRE_CENTS)) return NextResponse.json({ ok: false }, { status: 400 });

  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
  if (!pi || pi.status === "succeeded") return NextResponse.json({ ok: false }, { status: 404 });
  await stripe.paymentIntents.update(paymentIntentId, { amount: price, metadata: { ...(pi.metadata || {}), offerAccepted: "1" } });
  return NextResponse.json({ ok: true, label: formatPrice(price, "USD") });
}
