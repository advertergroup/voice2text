import { loadContent, t, getLocale } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";
import { localePath, DEFAULT_LOCALE, formatPrice } from "../../src/lib/locale.ts";

export const dynamic = "force-dynamic";

export default async function Pricing({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const prisma = await getPrisma();
  // Planes del idioma; si no hay para ese idioma, usa los del idioma base.
  let planes = await prisma.plan.findMany({ where: { activo: true, locale }, orderBy: { orden: "asc" } });
  if (planes.length === 0 && locale !== DEFAULT_LOCALE) {
    planes = await prisma.plan.findMany({ where: { activo: true, locale: DEFAULT_LOCALE }, orderBy: { orden: "asc" } });
  }

  const precio = (p: { precioCent: number; moneda: string }) => formatPrice(p.precioCent, p.moneda);
  const trialDays = Number(process.env.TRIAL_DAYS || 7);

  const PER: Record<string, { month: string; year: string }> = {
    es: { month: "mes", year: "año" }, en: { month: "month", year: "year" }, pt: { month: "mês", year: "ano" },
    fr: { month: "mois", year: "an" }, de: { month: "Monat", year: "Jahr" }, it: { month: "mese", year: "anno" },
    nl: { month: "maand", year: "jaar" }, pl: { month: "miesiąc", year: "rok" },
  };
  const per = PER[locale] || PER.es!;

  return (
    <>
      <Nav c={c} user={user} locale={locale} />
      <div className="hero" style={{ paddingBottom: 20 }}>
        <div className="container">
          <h1 style={{ fontSize: 42 }}>{t(c, "pricing.title")}</h1>
          <p className="sub">{t(c, "pricing.subtitle")}</p>
        </div>
      </div>
      <section style={{ paddingTop: 20 }}>
        <div className="container">
          {sp.error === "pago" && <div className="err" style={{ marginBottom: 16 }}>⚠️ No se pudo iniciar el pago. Inténtalo de nuevo en unos minutos.</div>}
          {sp.error === "config" && <div className="err" style={{ marginBottom: 16 }}>⚠️ Este plan aún no está disponible para pago. Vuelve a intentarlo pronto.</div>}
          <div className="plans">
            {planes.map((p: any) => (
              <div className={"plan" + (p.destacado ? " top" : "")} key={p.id}>
                {trialDays > 0 && p.key === "premium" ? <span className="badge">{trialDays} días gratis</span> : p.badge && <span className="badge">{p.badge}</span>}
                <h3 style={{ fontSize: 20, margin: "6px 0" }}>{p.nombre}</h3>
                <div className="price">{precio(p)}<small> / {p.periodo === "year" ? per.year : per.month}</small></div>
                {trialDays > 0 && p.key === "premium" && <p style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", marginTop: 4 }}>{trialDays} días gratis, luego {precio(p)}/{per.month}</p>}
                {p.descripcion && <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{p.descripcion}</p>}
                <ul>{(p.caracteristicas as string[]).map((f, i) => <li key={i}>{f}</li>)}</ul>
                <a href={user ? `/api/checkout?plan=${p.key}` : localePath(locale, `/register?plan=${p.key}`)} className={"btn " + (p.destacado ? "btn-primary" : "btn-ghost")} style={{ marginTop: "auto" }}>{trialDays > 0 && p.key === "premium" ? `Empezar ${trialDays} días gratis` : p.botonTexto}</a>
              </div>
            ))}
          </div>
          <p className="section-sub" style={{ marginTop: 30, marginBottom: 0 }}>{t(c, "pricing.note")}</p>
        </div>
      </section>
      <Footer c={c} locale={locale} />
    </>
  );
}
