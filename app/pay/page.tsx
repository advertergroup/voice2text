import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPrisma } from "../../src/db/client.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { tieneStripe, getStripe } from "../../src/lib/stripe.ts";
import { ANON_COOKIE } from "../../src/lib/funnel.ts";
import { formatPrice } from "../../src/lib/locale.ts";
import { CheckoutForm } from "../../src/ui/CheckoutForm.tsx";

export const dynamic = "force-dynamic";

const TRIPWIRE_CENTS = Number(process.env.TRIPWIRE_CENTS || 99);
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);

export default async function Pay({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!tieneStripe()) redirect("/pricing");
  const prisma = await getPrisma();
  const user = await getCurrentUser();

  // Transcripción a desbloquear (opcional). Verifica propiedad.
  let tr: any = null;
  if (sp.t) {
    tr = await prisma.transcription.findUnique({ where: { id: sp.t } });
    const anon = (await cookies()).get(ANON_COOKIE)?.value;
    const owns = tr && ((user && tr.userId === user.id) || (!!tr.anonSession && !!anon && tr.anonSession === anon));
    if (!owns) tr = null;
  }

  const plan = await prisma.plan.findFirst({ where: { key: "premium", locale: "es" } });
  const monthlyLabel = plan ? formatPrice(plan.precioCent, plan.moneda) : "$49.90";
  const todayLabel = formatPrice(TRIPWIRE_CENTS, "USD");

  // PaymentIntent del cargo de hoy (guarda la tarjeta para la suscripción posterior).
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: TRIPWIRE_CENTS,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { transcriptionId: tr?.id || "", anonSession: tr?.anonSession || "", userId: user?.id || "" },
  });

  return (
    <CheckoutForm
      clientSecret={pi.client_secret!}
      pk={process.env.STRIPE_PUBLISHABLE_KEY || ""}
      todayLabel={todayLabel}
      monthlyLabel={monthlyLabel}
      trialDays={TRIAL_DAYS}
      transcriptionId={tr?.id || ""}
      prefillEmail={user?.email || ""}
      titulo={tr?.titulo || ""}
    />
  );
}
