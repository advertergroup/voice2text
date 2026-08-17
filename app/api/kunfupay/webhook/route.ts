import { getPrisma } from "../../../../src/db/client.ts";
import { verifyWebhook } from "../../../../src/lib/kunfupay.ts";
import { unlockUser } from "../../../../src/lib/funnel.ts";

export const runtime = "nodejs";

/** Normaliza un timestamp de Kunfupay (ms, segundos o ISO) a Date, o null si no es válido. */
function toDate(v: unknown): Date | null {
  if (typeof v === "number" && v > 0) return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === "string") { const d = new Date(v); return isNaN(+d) ? null : d; }
  return null;
}

/**
 * Webhook de Kunfupay. Verifica la firma (X-Webhook-Signature) y actualiza el estado de la
 * suscripción del usuario. Kunfupay reintenta si no respondemos 200 en <10 s.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.KUNFUPAY_WEBHOOK_SECRET;
  const sig = req.headers.get("x-webhook-signature");

  // Fail-closed: sin secreto NO se puede verificar → se rechaza (evita webhooks falsos que
  // activarían suscripciones de cualquiera). Daniel debe fijar KUNFUPAY_WEBHOOK_SECRET.
  if (!secret) return new Response("webhook secret not configured", { status: 503 });
  if (!verifyWebhook(raw, sig, secret)) return new Response("bad signature", { status: 400 });

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  const type: string = evt?.eventType || evt?.type || "";
  const p: any = evt?.payload || evt?.data || {};
  const prisma = await getPrisma();

  // El usuario se identifica por customerId (= nuestro user.id) o externalReference/metadata.
  const userId: string | null = p.customerId || p.externalReference || p.metadata?.userId || null;
  if (!userId) return new Response("ok (sin usuario)", { status: 200 });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return new Response("ok (usuario no encontrado)", { status: 200 });

  // Orden: ignora eventos anteriores al último aplicado (retries / llegada fuera de orden).
  const eventTs = toDate(evt?.timestamp)?.getTime() ?? Date.now();
  if (user.subEventAt && eventTs <= user.subEventAt.getTime()) {
    return new Response("ok (evento antiguo)", { status: 200 });
  }

  const data: any = { subEventAt: new Date(eventTs) };
  const cpe = toDate(p.currentPeriodEnd);

  switch (type) {
    case "subscription.activated":
      data.subStatus = "ACTIVE";
      if (p.subscriptionId) data.kunfupaySubscriptionId = p.subscriptionId;
      if (p.metadata?.planKey) data.planKey = p.metadata.planKey;
      if (cpe) data.currentPeriodEnd = cpe;
      break;
    case "subscription.payment_succeeded":
      data.subStatus = "ACTIVE";
      if (cpe) data.currentPeriodEnd = cpe;
      break;
    case "subscription.payment_failed":
      data.subStatus = "PAST_DUE";
      break;
    case "subscription.suspended":
      data.subStatus = "CANCELED"; // suspendida por impago → revocar acceso
      break;
    case "subscription.canceled":
      data.subStatus = "CANCELED";
      break;
    default:
      return new Response("ok (evento ignorado)", { status: 200 });
  }

  await prisma.user.update({ where: { id: user.id }, data }).catch(() => {});
  if (data.subStatus === "ACTIVE") await unlockUser(user.id); // desbloquea/transcribe el resto
  return new Response("ok", { status: 200 });
}
