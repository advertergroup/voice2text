import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs } from "../../../src/ui/AdminTabs.tsx";

export const dynamic = "force-dynamic";

export default async function AdminLandings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const prisma = await getPrisma();
  const items = await prisma.landingPage.findMany({ orderBy: { orden: "asc" } });

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Administración</h1>
      <AdminTabs active="landings" />
      {sp.saved && <div className="ok">✓ Landings guardadas.</div>}
      <p className="muted" style={{ fontSize: 14 }}>Páginas SEO en <code>/l/&lt;slug&gt;</code>. Usa <code>{"{brand}"}</code> en el cuerpo. HTML permitido.</p>
      <form action="/api/admin/landings" method="post">
        {items.map((it: any) => (
          <div className="card" key={it.id} style={{ marginBottom: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>/l/{it.slug}</div>
            <div className="field"><label>Título (H1)</label><input name={`${it.id}__titulo`} defaultValue={it.titulo} /></div>
            <div className="field"><label>Subtítulo</label><textarea name={`${it.id}__subtitulo`} rows={2} defaultValue={it.subtitulo} /></div>
            <div className="field"><label>Cuerpo (HTML)</label><textarea name={`${it.id}__cuerpo`} rows={5} defaultValue={it.cuerpo} /></div>
            <div className="field"><label>Meta descripción</label><input name={`${it.id}__metaDesc`} defaultValue={it.metaDesc} /></div>
            <label style={{ fontSize: 14 }}><input type="checkbox" name={`${it.id}__activo`} defaultChecked={it.activo} style={{ width: "auto" }} /> Activo</label>
          </div>
        ))}
        <button className="btn btn-primary">Guardar landings</button>
      </form>
    </AppShell>
  );
}
