import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tieneStripe, getStripe } from "../../../../src/lib/stripe.ts";
import { registrarEvento } from "../../../../src/lib/eventos.ts";
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
  // Suelo de Stripe (USD, cuenta que liquida en USD): $0.50. Por debajo, el
  // update del PaymentIntent revienta y el visitante ve la oferta fallar en
  // silencio — mejor no ofrecerla que prometer un precio incobrable.
  if (!enabled || !(price >= 50 && price < TRIPWIRE_CENTS)) return NextResponse.json({ ok: false }, { status: 400 });

  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
  if (!pi || pi.status === "succeeded") return NextResponse.json({ ok: false }, { status: 404 });
  await stripe.paymentIntents.update(paymentIntentId, { amount: price, metadata: { ...(pi.metadata || {}), offerAccepted: "1" } });
  const jar = await cookies();
  await registrarEvento({ tipo: "offer_accepted", vid: jar.get("v2t_vid")?.value, origen: jar.get("v2t_src")?.value, valorCent: price, meta: paymentIntentId, path: "/pay" });
  return NextResponse.json({ ok: true, label: formatPrice(price, "USD") });
}
