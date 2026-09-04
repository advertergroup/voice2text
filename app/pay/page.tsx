import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPrisma } from "../../src/db/client.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { loadContent } from "../../src/lib/content.ts";
import { tieneStripe, getStripe } from "../../src/lib/stripe.ts";
import { ANON_COOKIE } from "../../src/lib/funnel.ts";
import { formatPrice, isLocale, DEFAULT_LOCALE, LANG_COOKIE } from "../../src/lib/locale.ts";
import { ui } from "../../src/lib/ui.ts";
import { CheckoutForm } from "../../src/ui/CheckoutForm.tsx";

export const dynamic = "force-dynamic";

const TRIPWIRE_CENTS = Number(process.env.TRIPWIRE_CENTS || 99);
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);

export default async function Pay({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!tieneStripe()) redirect("/pricing");
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const jar = await cookies();
  const cookieLang = jar.get(LANG_COOKIE)?.value;
  const locale = isLocale(cookieLang) ? cookieLang! : DEFAULT_LOCALE;

  // Transcripción a desbloquear (opcional). Verifica propiedad.
  let tr: any = null;
  if (sp.t) {
    tr = await prisma.transcription.findUnique({ where: { id: sp.t } });
    const anon = jar.get(ANON_COOKIE)?.value;
    const owns = tr && ((user && tr.userId === user.id) || (!!tr.anonSession && !!anon && tr.anonSession === anon));
    if (!owns) tr = null;
  }

  const plan = await prisma.plan.findFirst({ where: { key: "premium", locale: "es" } });
  const monthlyLabel = plan ? formatPrice(plan.precioCent, plan.moneda) : "$49.90";
  const todayLabel = formatPrice(TRIPWIRE_CENTS, "USD");

  // Textos del checkout editables (versión normal o Google Ads según la cookie v2t_src).
  const cont = await loadContent(locale);
  const isAds = jar.get("v2t_src")?.value === "ads";
  const pick = (base: string) => {
    if (isAds) { const a = cont[`${base}.ads`]; if (a !== undefined && a !== "") return a; }
    return cont[base] ?? "";
  };
  const textos = {
    subtitle: pick("checkout.subtitle"),
    button: pick("checkout.button"),
    legal: pick("checkout.legal"),
    secure: pick("checkout.secure"),
  };

  // Oferta de salida (exit-intent): precio menor hoy si va a abandonar.
  const eoPrice = parseInt(cont["exitoffer.price"] || "0", 10);
  const exitOffer = (cont["exitoffer.enabled"] === "1" && eoPrice > 0 && eoPrice < TRIPWIRE_CENTS) ? {
    label: formatPrice(eoPrice, "USD"),
    title: pick("exitoffer.title"),
    text: pick("exitoffer.text"),
    accept: pick("exitoffer.accept"),
    decline: pick("exitoffer.decline"),
  } : null;

  // PaymentIntent del cargo de hoy (guarda la tarjeta para la suscripción posterior).
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: TRIPWIRE_CENTS,
    currency: "usd",
    // Solo tarjeta ("card" YA incluye Apple Pay y Google Pay por monedero).
    // Motivo medido en SnapPassport: Link mete un intermediario que rompe
    // cobros que la tarjeta sola aprueba (39/39 partner_insufficient_funds y
    // 30/30 generic_payment_failed eran Link).
    payment_method_types: ["card"],
    metadata: { transcriptionId: tr?.id || "", anonSession: tr?.anonSession || "", userId: user?.id || "", gclid: jar.get("v2t_gclid")?.value?.slice(0, 120) || "" },
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
      s={ui(locale)}
      textos={textos}
      exitOffer={exitOffer}
      brand={cont["brand.name"] || "Voice To Text"}
    />
  );
}
