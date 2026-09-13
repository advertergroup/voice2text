import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { loadContent, t, getLocale } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { LanguageSwitcher } from "../../../src/ui/site.tsx";
import { Resultado } from "../../../src/ui/Resultado.tsx";
import { precioPara } from "../../../src/lib/precio.ts";
import { ui } from "../../../src/lib/ui.ts";
import { ANON_COOKIE, esPagado, unlockUser } from "../../../src/lib/funnel.ts";
import { eventoEmbudo } from "../../../src/lib/embudo.ts";

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

  // Comprador con la transcripción aún bloqueada = el desbloqueo en 2º plano no
  // terminó (o falló). Se RE-LANZA (idempotente) y se enseña la espera con
  // sondeo, nunca el candado a quien ya pagó.
  const desbloqueando = !!(esPagado(user) && tr.locked && tr.userId === user?.id);
  if (desbloqueando) void unlockUser(user!.id);

  // Embudo: preview vista y, si sigue con candado, muro de pago visto. Se AWAITA
  // (no void): eventoEmbudo lee cookies() y, si se deja fire-and-forget al final
  // del render, esa lectura ocurre fuera del scope de la petición y se pierde.
  if (tr.status === "DONE") {
    await eventoEmbudo("preview_viewed", { trId: tr.id });
    if (tr.locked && !desbloqueando) await eventoEmbudo("paywall_viewed", { trId: tr.id });
  }

  const plan = await prisma.plan.findFirst({ where: { key: "premium", locale: "es" } });
  const P = precioPara(locale);
  const precio = P.monthlyLabel;
  const trialDays = Number(process.env.TRIAL_DAYS || 7);
  const todayLabel = P.todayLabel;
  const s = ui(locale);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Cabecera mínima: logo (sin enlace) + idioma. Sin menú, sin login/registro → sin puntos de fuga. */}
      <div className="nav">
        <div className="container nav-in">
          <span className="logo" style={{ cursor: "default" }}><span className="mark">🎙️</span>{t(c, "brand.name")}</span>
          {/* @ts-expect-error Async Server Component */}
          <LanguageSwitcher locale={locale} />
        </div>
      </div>

      <section style={{ flex: 1, paddingTop: 26, paddingBottom: 40 }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <Resultado tr={tr as any} s={s} precio={precio} ctaHref={`/pay?t=${tr.id}`} trialDays={trialDays} todayLabel={todayLabel} desbloqueando={desbloqueando} />
        </div>
      </section>

      <div style={{ textAlign: "center", padding: "20px 16px", color: "var(--muted)", fontSize: 12, borderTop: "1px solid var(--border)" }}>
        <a href="/terms" style={{ color: "var(--muted)" }}>{s.legal_terms}</a> ·
        <a href="/refund" style={{ color: "var(--muted)" }}> {s.legal_sub}</a> ·
        <a href="/privacy" style={{ color: "var(--muted)" }}> {s.legal_privacy}</a>
      </div>
    </div>
  );
}
