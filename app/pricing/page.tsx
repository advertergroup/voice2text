import { loadContent, t, getLocale } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";
import { localePath, DEFAULT_LOCALE } from "../../src/lib/locale.ts";

export const dynamic = "force-dynamic";

export default async function Pricing() {
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const prisma = await getPrisma();
  // Planes del idioma; si no hay para ese idioma, usa los del idioma base.
  let planes = await prisma.plan.findMany({ where: { activo: true, locale }, orderBy: { orden: "asc" } });
  if (planes.length === 0 && locale !== DEFAULT_LOCALE) {
    planes = await prisma.plan.findMany({ where: { activo: true, locale: DEFAULT_LOCALE }, orderBy: { orden: "asc" } });
  }

  const precio = (p: { precioCent: number; moneda: string }) =>
    (p.precioCent / 100).toLocaleString(locale, { minimumFractionDigits: 2 }) + " " + (p.moneda === "EUR" ? "€" : p.moneda);

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
          <div className="plans">
            {planes.map((p: any) => (
              <div className={"plan" + (p.destacado ? " top" : "")} key={p.id}>
                {p.badge && <span className="badge">{p.badge}</span>}
                <h3 style={{ fontSize: 20, margin: "6px 0" }}>{p.nombre}</h3>
                <div className="price">{precio(p)}<small> / {p.periodo === "trial" ? `${p.badge || per.month}` : p.periodo === "year" ? per.year : per.month}</small></div>
                {p.descripcion && <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{p.descripcion}</p>}
                <ul>{(p.caracteristicas as string[]).map((f, i) => <li key={i}>{f}</li>)}</ul>
                <a href={user ? `/api/checkout?plan=${p.key}` : localePath(locale, `/register?plan=${p.key}`)} className={"btn " + (p.destacado ? "btn-primary" : "btn-ghost")} style={{ marginTop: "auto" }}>{p.botonTexto}</a>
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
