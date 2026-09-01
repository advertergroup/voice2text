import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs } from "../../../src/ui/AdminTabs.tsx";
import { HeatmapView } from "../../../src/ui/HeatmapView.tsx";

export const dynamic = "force-dynamic";

/** Mapa de calor: clicks reales sobre la página, ranking de elementos, scroll y tiempo en página. */

interface Click { x: number; y: number; vp: string; el: string; vid: string }

export default async function Heatmap({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const prisma = await getPrisma();
  const dias = [7, 14, 30].includes(Number(sp.dias)) ? Number(sp.dias) : 14;
  const desde = new Date(Date.now() - dias * 864e5);
  const vp = sp.vp === "movil" ? "movil" : "desktop";

  // Páginas con clicks en el periodo (para el selector).
  const topPages = await prisma.$queryRawUnsafe<any[]>(
    `select path, count(*)::int as n from "Evento" where tipo = 'click' and "createdAt" > now() - interval '${dias} days' and path is not null group by 1 order by 2 desc limit 15`);

  const esRutaSegura = (p: unknown): p is string => typeof p === "string" && /^\/[a-z0-9\-/._]*$/i.test(p) && !p.startsWith("//");
  const page = esRutaSegura(sp.page) ? sp.page : (topPages[0]?.path as string) || "/en";

  // Clicks y engagement de la página elegida.
  const clickRows = await prisma.evento.findMany({
    where: { tipo: "click", path: page, createdAt: { gte: desde } },
    select: { meta: true, vid: true }, take: 3000, orderBy: { createdAt: "desc" },
  });
  const clicks: Click[] = [];
  for (const r of clickRows) {
    try { const m = JSON.parse(r.meta || "{}"); clicks.push({ x: Number(m.x) || 0, y: Number(m.y) || 0, vp: m.vp === "movil" ? "movil" : "desktop", el: String(m.el || "?"), vid: r.vid || "?" }); } catch { /* fila corrupta */ }
  }
  const delVp = clicks.filter((k) => k.vp === vp);
  const clickers = new Set(delVp.map((k) => k.vid)).size;

  const engRows = await prisma.evento.findMany({
    where: { tipo: "engagement", path: page, createdAt: { gte: desde } },
    select: { meta: true, valorCent: true }, take: 3000,
  });
  let engN = 0, segTotal = 0; const scrollHito = { 25: 0, 50: 0, 75: 0, 95: 0 } as Record<number, number>;
  for (const r of engRows) {
    try {
      const m = JSON.parse(r.meta || "{}");
      if ((m.vp === "movil" ? "movil" : "desktop") !== vp) continue;
      engN++; segTotal += r.valorCent || 0;
      const s = Number(m.scroll) || 0;
      for (const h of [25, 50, 75, 95]) if (s >= h) scrollHito[h]++;
    } catch { /* nada */ }
  }

  // Ranking de elementos clicados.
  const porElemento = new Map<string, number>();
  for (const k of delVp) porElemento.set(k.el, (porElemento.get(k.el) || 0) + 1);
  const ranking = [...porElemento.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  const td = { padding: "5px 8px", borderBottom: "1px solid var(--border)", fontSize: 13 } as const;
  const link = (href: string, label: string, activo: boolean) => (
    <a key={href} href={href} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, textDecoration: "none", background: activo ? "var(--accent, #4f46e5)" : "transparent", color: activo ? "#fff" : "inherit" }}>{label}</a>
  );
  const qs = (p: Record<string, string | number>) => "/admin/heatmap?" + new URLSearchParams({ page, vp, dias: String(dias), ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) }).toString();

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Mapa de calor</h1>
      <AdminTabs active="heatmap" />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        <span className="muted" style={{ fontSize: 13 }}>Página:</span>
        {topPages.length === 0 && <span className="muted" style={{ fontSize: 13 }}>aún sin clicks registrados — llegarán con las primeras visitas</span>}
        {topPages.map((p: any) => link(qs({ page: p.path }), `${p.path} (${p.n})`, p.path === page))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span className="muted" style={{ fontSize: 13 }}>Dispositivo:</span>
        {link(qs({ vp: "desktop" }), "🖥️ Desktop", vp === "desktop")}
        {link(qs({ vp: "movil" }), "📱 Móvil", vp === "movil")}
        <span className="muted" style={{ fontSize: 13, marginLeft: 10 }}>Periodo:</span>
        {[7, 14, 30].map((d) => link(qs({ dias: d }), `${d} días`, d === dias))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          ["Clicks", String(delVp.length)],
          ["Personas que clican", String(clickers)],
          ["Visitas medidas", String(engN)],
          ["Tiempo medio", engN ? Math.round(segTotal / engN) + " s" : "—"],
          ["Llegan a mitad de página", pctStr(scrollHito[50], engN)],
          ["Llegan al final", pctStr(scrollHito[95], engN)],
        ].map(([l, v]) => (
          <div className="card" key={l} style={{ padding: "10px 14px", minWidth: 130, flex: "1 1 130px" }}>
            <div className="muted" style={{ fontSize: 12 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "0 1 auto", maxWidth: "100%" }}>
          <HeatmapView url={`${page}${page.includes("?") ? "&" : "?"}hm=1`} clicks={delVp.map(({ x, y }) => ({ x, y }))} vp={vp} />
          <p className="muted" style={{ fontSize: 12, maxWidth: 640 }}>
            Cada punto es un click real ({vp === "movil" ? "pantallas de móvil" : "el ancho exacto varía por pantalla; la posición horizontal es aproximada"}).
            El scroll de esta vista recorre la página completa.
          </p>
        </div>
        <div className="card" style={{ flex: "1 1 300px", minWidth: 280 }}>
          <h3 style={{ marginTop: 0 }}>Qué clican ({vp})</h3>
          {ranking.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Sin clicks todavía en esta página.</p>}
          <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
            {ranking.map(([el, n]) => (
              <tr key={el}><td style={td}>{el}</td><td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n}</td></tr>
            ))}
          </tbody></table>
          <h3>Scroll ({vp})</h3>
          <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
            {[[25, "Pasan del primer scroll"], [50, "Llegan a la mitad"], [75, "Llegan al 75 %"], [95, "Llegan al final"]].map(([h, l]) => (
              <tr key={h}><td style={td}>{l}</td><td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pctStr(scrollHito[h as number], engN)}</td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </AppShell>
  );
}

const pctStr = (n: number, total: number) => (total > 0 ? Math.round((100 * n) / total) + "%" : "—");
