import { getPrisma } from "../../../../src/db/client.ts";
import { tieneStripe, getStripe } from "../../../../src/lib/stripe.ts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!tieneStripe()) return new Response("stripe off", { status: 200 });
  const stripe = await getStripe();
  const sig = req.headers.get("stripe-signature") || "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();
  let evt: any;
  try {
    evt = secret ? stripe.webhooks.constructEvent(raw, sig, secret) : JSON.parse(raw);
  } catch (e) {
    return new Response(`bad sig: ${e instanceof Error ? e.message : ""}`, { status: 400 });
  }
  const prisma = await getPrisma();

  const setSub = async (customerId: string, data: any) => {
    const u = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
    if (u) await prisma.user.update({ where: { id: u.id }, data });
  };

  switch (evt.type) {
    case "checkout.session.completed": {
      const s = evt.data.object;
      const userId = s.metadata?.userId;
      if (userId) await prisma.user.update({ where: { id: userId }, data: { subStatus: "ACTIVE", planKey: s.metadata?.planKey || "premium", stripeSubscriptionId: s.subscription, stripeCustomerId: s.customer } }).catch(() => {});
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = evt.data.object;
      const map: Record<string, string> = { active: "ACTIVE", trialing: "TRIAL", past_due: "PAST_DUE", canceled: "CANCELED", unpaid: "PAST_DUE" };
      await setSub(sub.customer, { subStatus: map[sub.status] || "ACTIVE", stripeSubscriptionId: sub.id, currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null });
      break;
    }
    case "customer.subscription.deleted": {
      await setSub(evt.data.object.customer, { subStatus: "CANCELED" });
      break;
    }
  }
  return new Response("ok", { status: 200 });
}
