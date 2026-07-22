import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";

export const dynamic = "force-dynamic";

export default async function Pricing() {
  const c = await loadContent();
  const user = await getCurrentUser();
  const prisma = await getPrisma();
  const planes = await prisma.plan.findMany({ where: { activo: true }, orderBy: { orden: "asc" } });

  const precio = (p: { precioCent: number; moneda: string }) =>
    (p.precioCent / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " " + (p.moneda === "EUR" ? "€" : p.moneda);

  return (
    <>
      <Nav c={c} user={user} />
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
                <div className="price">{precio(p)}<small> / {p.periodo === "trial" ? `${p.badge || "prueba"}` : p.periodo === "year" ? "año" : "mes"}</small></div>
                {p.descripcion && <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{p.descripcion}</p>}
                <ul>{(p.caracteristicas as string[]).map((f, i) => <li key={i}>{f}</li>)}</ul>
                <a href={user ? `/api/checkout?plan=${p.key}` : `/register?plan=${p.key}`} className={"btn " + (p.destacado ? "btn-primary" : "btn-ghost")} style={{ marginTop: "auto" }}>{p.botonTexto}</a>
              </div>
            ))}
          </div>
          <p className="section-sub" style={{ marginTop: 30, marginBottom: 0 }}>{t(c, "pricing.note")}</p>
        </div>
      </section>
      <Footer c={c} />
    </>
  );
}
