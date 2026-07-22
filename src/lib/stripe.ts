/** Helpers de Stripe. Todo env-gated: si no hay STRIPE_SECRET_KEY, la app funciona en modo mock. */
export function tieneStripe(): boolean { return !!process.env.STRIPE_SECRET_KEY; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _stripe: any = null;
export async function getStripe() {
  if (_stripe) return _stripe;
  const Stripe = (await import("stripe")).default;
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}
