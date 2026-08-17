import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { loadContent, t, getLocale } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { Nav, Footer } from "../../../src/ui/site.tsx";
import { Resultado } from "../../../src/ui/Resultado.tsx";
import { localePath, formatPrice } from "../../../src/lib/locale.ts";
import { ANON_COOKIE } from "../../../src/lib/funnel.ts";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id } });
  if (!tr) notFound();

  // Acceso: dueño autenticado o dueño de la sesión anónima.
  const anon = (await cookies()).get(ANON_COOKIE)?.value;
  const owns = (user && tr.userId === user.id) || (!!tr.anonSession && !!anon && tr.anonSession === anon);
  if (!owns) notFound();

  const plan = await prisma.plan.findFirst({ where: { key: "premium", locale: "es" } });
  const precio = plan ? formatPrice(plan.precioCent, plan.moneda) : "";
  const trialDays = Number(process.env.TRIAL_DAYS || 7);
  const todayLabel = formatPrice(Number(process.env.TRIPWIRE_CENTS || 99), "USD");
  const ctaHref = `/pay?t=${tr.id}`; // checkout propio, sin crear cuenta

  return (
    <>
      <Nav c={c} user={user} locale={locale} />
      <section style={{ paddingTop: 26 }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <a href={user ? "/dashboard" : localePath(locale, "/")} className="muted" style={{ fontSize: 14 }}>← {user ? "Mi panel" : t(c, "brand.name")}</a>
          <Resultado tr={tr as any} c={c} locale={locale} precio={precio} ctaHref={ctaHref} trialDays={trialDays} todayLabel={todayLabel} />
        </div>
      </section>
      <Footer c={c} locale={locale} />
    </>
  );
}
