import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente de Kunfupay (pasarela de pagos, EUR). Todo env-gated:
 *   KUNFUPAY_API_KEY       — clave live (kfp_live_<id>.<secret>). SOLO en el .env del servidor.
 *   KUNFUPAY_PRODUCT_ID    — id del producto de suscripción creado en el dashboard.
 *   KUNFUPAY_WEBHOOK_SECRET— secreto para verificar la firma de los webhooks.
 *   KUNFUPAY_BASE          — base de la API (por defecto https://store.kunfupay.com/api/v1).
 *   PAYMENT_PROVIDER       — "kunfupay" | "stripe" | "mock" (si no, se autodetecta).
 */

const BASE = process.env.KUNFUPAY_BASE || "https://store.kunfupay.com/api/v1";

export function tieneKunfupay(): boolean {
  return !!process.env.KUNFUPAY_API_KEY;
}

/** Pasarela activa. Explícita por PAYMENT_PROVIDER, o autodetectada por las claves presentes. */
export function activeProvider(): "kunfupay" | "stripe" | "mock" {
  const p = (process.env.PAYMENT_PROVIDER || "").toLowerCase();
  if (p === "kunfupay" || p === "stripe" || p === "mock") return p;
  if (process.env.KUNFUPAY_API_KEY) return "kunfupay";
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  return "mock";
}

async function kfp(path: string, init?: RequestInit): Promise<any> {
  const key = process.env.KUNFUPAY_API_KEY;
  if (!key) throw new Error("Falta KUNFUPAY_API_KEY.");
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-API-Key": key, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const txt = await r.text();
  let body: any = null;
  try { body = txt ? JSON.parse(txt) : null; } catch { body = { raw: txt }; }
  if (!r.ok) throw new Error(`Kunfupay ${r.status}: ${body?.error || body?.message || txt.slice(0, 200)}`);
  return body;
}

export interface KfpPlan { id: string; name: string; price: number; currency: string; billingInterval: { unit: string; count: number } }
export interface KfpProduct { id: string; name: string; description?: string; paymentPlans: KfpPlan[] }

/** Devuelve el producto con sus planes de pago (para mapear paymentPlanId). */
export function getProduct(productId: string): Promise<KfpProduct> {
  return kfp(`/external/products/${productId}`);
}

export interface CrearSesion {
  productId: string;
  paymentPlanId: string;
  customerId?: string;
  customerEmail?: string;
  externalReference?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Crea una sesión de suscripción y devuelve { id, checkoutUrl, ... } para redirigir al cliente. */
export function createSubscriptionSession(data: CrearSesion): Promise<{ id: string; checkoutUrl: string; status: string; amount: number; currency: string }> {
  return kfp(`/external/subscriptions/create`, { method: "POST", body: JSON.stringify(data) });
}

export function getSubscription(id: string): Promise<any> {
  return kfp(`/external/subscriptions/${id}`);
}

export function cancelSubscription(id: string): Promise<any> {
  return kfp(`/external/subscriptions/${id}/cancel`, { method: "POST" });
}

/**
 * Verifica la firma del webhook: X-Webhook-Signature == "sha256=" + HMAC_SHA256(rawBody, secret).
 * Comparación en tiempo constante. Devuelve false si algo no cuadra.
 */
export function verifyWebhook(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
