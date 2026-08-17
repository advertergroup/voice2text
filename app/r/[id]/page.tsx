import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { loadContent, t, getLocale } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { LanguageSwitcher } from "../../../src/ui/site.tsx";
import { Resultado } from "../../../src/ui/Resultado.tsx";
import { formatPrice } from "../../../src/lib/locale.ts";
import { ui } from "../../../src/lib/ui.ts";
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

  const anon = (await cookies()).get(ANON_COOKIE)?.value;
  const owns = (user && tr.userId === user.id) || (!!tr.anonSession && !!anon && tr.anonSession === anon);
  if (!owns) notFound();

  const plan = await prisma.plan.findFirst({ where: { key: "premium", locale: "es" } });
  const precio = plan ? formatPrice(plan.precioCent, plan.moneda) : "";
  const trialDays = Number(process.env.TRIAL_DAYS || 7);
  const todayLabel = formatPrice(Number(process.env.TRIPWIRE_CENTS || 99), "USD");
  const s = ui(locale);

  return (
    <>
      {/* Cabecera mínima: logo (sin enlace) + idioma. Sin menú, sin login/registro → sin puntos de fuga. */}
      <div className="nav">
        <div className="container nav-in">
          <span className="logo" style={{ cursor: "default" }}><span className="mark">🎙️</span>{t(c, "brand.name")}</span>
          {/* @ts-expect-error Async Server Component */}
          <LanguageSwitcher locale={locale} />
        </div>
      </div>

      <section style={{ paddingTop: 26, paddingBottom: 40 }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <Resultado tr={tr as any} s={s} precio={precio} ctaHref={`/pay?t=${tr.id}`} trialDays={trialDays} todayLabel={todayLabel} />
        </div>
      </section>

      <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--muted)", fontSize: 12 }}>
        <a href="/terms" style={{ color: "var(--muted)" }}>{s.legal_terms}</a> ·
        <a href="/refund" style={{ color: "var(--muted)" }}> {s.legal_sub}</a> ·
        <a href="/privacy" style={{ color: "var(--muted)" }}> {s.legal_privacy}</a>
      </div>
    </>
  );
}
