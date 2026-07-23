import { redirect } from "next/navigation";
import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { AppShell } from "../../src/ui/AppShell.tsx";
import { AdminTabs, AdminLangBar } from "../../src/ui/AdminTabs.tsx";
import { isLocale, localeInfo, DEFAULT_LOCALE } from "../../src/lib/locale.ts";

export const dynamic = "force-dynamic";

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const lang = isLocale(sp.lang) ? sp.lang! : DEFAULT_LOCALE;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const prisma = await getPrisma();
  const rows = await prisma.siteContent.findMany({ where: { locale: lang }, orderBy: [{ grupo: "asc" }, { orden: "asc" }] });
  const grupos: Record<string, any[]> = {};
  for (const r of rows) (grupos[r.grupo] ??= []).push(r);

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Administración</h1>
      <AdminTabs active="textos" lang={lang} />
      <AdminLangBar base="/admin" lang={lang} />
      {sp.saved && <div className="ok">✓ Cambios guardados en {localeInfo(lang).native}.</div>}
      <p className="muted" style={{ fontSize: 14 }}>Editando los textos en <b>{localeInfo(lang).flag} {localeInfo(lang).native}</b>. Cambia de idioma con los botones de arriba. Usa <code>{"{brand}"}</code> para el nombre de la marca (se sustituye solo).</p>

      <form action="/api/admin/content" method="post">
        <input type="hidden" name="__locale" value={lang} />
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
