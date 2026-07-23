import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs, AdminLangBar } from "../../../src/ui/AdminTabs.tsx";
import { isLocale, localeInfo, DEFAULT_LOCALE } from "../../../src/lib/locale.ts";

export const dynamic = "force-dynamic";

export default async function AdminPlans({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const lang = isLocale(sp.lang) ? sp.lang! : DEFAULT_LOCALE;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const prisma = await getPrisma();
  const planes = await prisma.plan.findMany({ where: { locale: lang }, orderBy: { orden: "asc" } });

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Administración</h1>
      <AdminTabs active="plans" lang={lang} />
      <AdminLangBar base="/admin/plans" lang={lang} />
      {sp.saved && <div className="ok">✓ Planes guardados en {localeInfo(lang).native}.</div>}
      <p className="muted" style={{ fontSize: 13 }}>El precio es común a todos los idiomas; los textos (nombre, descripción, características, botón) son por idioma.</p>
      <form action="/api/admin/plans" method="post">
        <input type="hidden" name="formlocale" value={lang} />
        {planes.map((p: any) => (
          <div className="card" key={p.id} style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>{p.nombre} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>({p.key})</span></h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="field"><label>Nombre</label><input name={`${p.id}__nombre`} defaultValue={p.nombre} /></div>
              <div className="field"><label>Precio (€)</label><input name={`${p.id}__precioEur`} type="number" step="0.01" defaultValue={(p.precioCent / 100).toFixed(2)} /></div>
              <div className="field"><label>Periodo</label>
                <select name={`${p.id}__periodo`} defaultValue={p.periodo}><option value="trial">prueba</option><option value="month">mes</option><option value="year">año</option></select>
              </div>
              <div className="field"><label>Etiqueta (badge)</label><input name={`${p.id}__badge`} defaultValue={p.badge || ""} /></div>
              <div className="field"><label>Texto del botón</label><input name={`${p.id}__botonTexto`} defaultValue={p.botonTexto} /></div>
              <div className="field"><label>Stripe Price ID</label><input name={`${p.id}__stripePriceId`} defaultValue={p.stripePriceId || ""} placeholder="price_..." /></div>
            </div>
            <div className="field"><label>Descripción</label><textarea name={`${p.id}__descripcion`} rows={2} defaultValue={p.descripcion || ""} /></div>
            <div className="field"><label>Características (una por línea)</label><textarea name={`${p.id}__caracteristicas`} rows={5} defaultValue={(p.caracteristicas as string[]).join("\n")} /></div>
            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ fontSize: 14 }}><input type="checkbox" name={`${p.id}__destacado`} defaultChecked={p.destacado} style={{ width: "auto" }} /> Destacado</label>
              <label style={{ fontSize: 14 }}><input type="checkbox" name={`${p.id}__activo`} defaultChecked={p.activo} style={{ width: "auto" }} /> Activo</label>
            </div>
          </div>
        ))}
        <button className="btn btn-primary">Guardar planes</button>
      </form>
    </AppShell>
  );
}
