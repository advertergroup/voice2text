import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs, AdminLangBar } from "../../../src/ui/AdminTabs.tsx";
import { isLocale, localeInfo, DEFAULT_LOCALE } from "../../../src/lib/locale.ts";

export const dynamic = "force-dynamic";

export default async function AdminFaq({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const lang = isLocale(sp.lang) ? sp.lang! : DEFAULT_LOCALE;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const prisma = await getPrisma();
  const items = await prisma.faqItem.findMany({ where: { locale: lang }, orderBy: { orden: "asc" } });

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Administración</h1>
      <AdminTabs active="faq" lang={lang} />
      <AdminLangBar base="/admin/faq" lang={lang} />
      {sp.saved && <div className="ok">✓ FAQ guardada en {localeInfo(lang).native}.</div>}
      <form action="/api/admin/faq" method="post">
        <input type="hidden" name="formlocale" value={lang} />
        {items.map((it: any) => (
          <div className="card" key={it.id} style={{ marginBottom: 14 }}>
            <div className="field"><label>Pregunta</label><input name={`${it.id}__pregunta`} defaultValue={it.pregunta} /></div>
            <div className="field"><label>Respuesta</label><textarea name={`${it.id}__respuesta`} rows={2} defaultValue={it.respuesta} /></div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <label style={{ fontSize: 14 }}>Orden <input name={`${it.id}__orden`} type="number" defaultValue={it.orden} style={{ width: 70, display: "inline-block" }} /></label>
              <label style={{ fontSize: 14 }}><input type="checkbox" name={`${it.id}__activo`} defaultChecked={it.activo} style={{ width: "auto" }} /> Activo</label>
              <label style={{ fontSize: 14, color: "var(--good)" }}><input type="checkbox" name={`${it.id}__delete`} style={{ width: "auto" }} /> Borrar</label>
            </div>
          </div>
        ))}
        <div className="card" style={{ marginBottom: 14, borderStyle: "dashed" }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>➕ Nueva pregunta</h3>
          <div className="field"><input name="new__pregunta" placeholder="Pregunta nueva (déjala vacía para no crear)" /></div>
          <div className="field"><textarea name="new__respuesta" rows={2} placeholder="Respuesta" /></div>
        </div>
        <button className="btn btn-primary">Guardar FAQ</button>
      </form>
    </AppShell>
  );
}
