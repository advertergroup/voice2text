import { redirect } from "next/navigation";
import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { AppShell } from "../../src/ui/AppShell.tsx";
import { AdminTabs } from "../../src/ui/AdminTabs.tsx";

export const dynamic = "force-dynamic";

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const prisma = await getPrisma();
  const rows = await prisma.siteContent.findMany({ orderBy: [{ grupo: "asc" }, { orden: "asc" }] });
  const grupos: Record<string, any[]> = {};
  for (const r of rows) (grupos[r.grupo] ??= []).push(r);

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Administración</h1>
      <AdminTabs active="textos" />
      {sp.saved && <div className="ok">✓ Cambios guardados.</div>}
      <p className="muted" style={{ fontSize: 14 }}>Edita cualquier texto de la web. Usa <code>{"{brand}"}</code> como marcador para el nombre de la marca (se sustituye solo). El nombre de la marca se cambia en el grupo «Marca».</p>

      <form action="/api/admin/content" method="post">
        {Object.entries(grupos).map(([grupo, items]) => (
          <div className="card" key={grupo} style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>{grupo}</h3>
            {items.map((it) => (
              <div className="field" key={it.key}>
                <label>{it.label} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({it.key})</span></label>
                {it.multiline
                  ? <textarea name={it.key} defaultValue={it.value} rows={3} />
                  : <input name={it.key} defaultValue={it.value} />}
              </div>
            ))}
          </div>
        ))}
        <div style={{ position: "sticky", bottom: 0, background: "var(--bg)", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-primary">Guardar todos los textos</button>
        </div>
      </form>
    </AppShell>
  );
}
