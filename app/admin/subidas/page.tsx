import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs } from "../../../src/ui/AdminTabs.tsx";

export const dynamic = "force-dynamic";

/**
 * Subidas de TODOS los visitantes + conversión subida→compra.
 * Las subidas del propio admin quedan FUERA de los números (ensucian el %);
 * en la lista salen marcadas como «tú».
 */

const TZ = "Europe/Madrid";
const pct = (parte: number, total: number) => (total > 0 ? ((100 * parte) / total).toFixed(1) + "%" : "—");
const TIPO: Record<string, string> = { FILE: "📄 Archivo", URL: "🔗 URL", MIC: "🎙️ Micro", MANUAL: "⏳ Manual" };

export default async function Subidas() {
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const prisma = await getPrisma();

  // Día a día (14d) sin las subidas del admin: subidas, de ads, compradas, %.
  const dias = await prisma.$queryRawUnsafe<any[]>(`
    select to_char(t."createdAt" at time zone '${TZ}', 'YYYY-MM-DD') as dia,
           count(*)::int as subidas,
           count(*) filter (where t.origen = 'ads')::int as ads,
           count(*) filter (where not t.locked)::int as compradas,
           count(distinct coalesce(t."userId", t."anonSession"))::int as personas
      from "Transcription" t
      left join "User" u on u.id = t."userId"
     where t."createdAt" > now() - interval '14 days' and coalesce(u.role::text,'') <> 'ADMIN'
     group by 1 order by 1 desc`);

  const [tot] = await prisma.$queryRawUnsafe<any[]>(`
    select count(*)::int as subidas,
           count(*) filter (where not t.locked)::int as compradas,
           count(*) filter (where t.origen = 'ads')::int as ads,
           count(*) filter (where t.origen = 'ads' and not t.locked)::int as ads_compradas
      from "Transcription" t
      left join "User" u on u.id = t."userId"
     where t."createdAt" > now() - interval '30 days' and coalesce(u.role::text,'') <> 'ADMIN'`);

  // Últimas subidas (las del admin salen, marcadas, pero no cuentan arriba).
  const filas = await prisma.transcription.findMany({
    orderBy: { createdAt: "desc" }, take: 60,
    select: { id: true, titulo: true, sourceType: true, status: true, locked: true, origen: true, duracionSeg: true, language: true, preview: true, createdAt: true, contactEmail: true, user: { select: { email: true, role: true } } },
  });

  const td = { padding: "6px 8px", borderBottom: "1px solid var(--border)", fontSize: 13, verticalAlign: "top" as const };
  const th = { ...td, fontWeight: 700, whiteSpace: "nowrap" as const };
  const fecha = (d: Date) => d.toLocaleString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Subidas y conversión</h1>
      <AdminTabs active="subidas" />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "14px 0" }}>
        {[
          ["Subidas 30d", String(tot?.subidas ?? 0)],
          ["Compradas", String(tot?.compradas ?? 0)],
          ["Conversión subida→compra", pct(tot?.compradas ?? 0, tot?.subidas ?? 0)],
          ["Subidas de Ads", String(tot?.ads ?? 0)],
          ["Conversión Ads", pct(tot?.ads_compradas ?? 0, tot?.ads ?? 0)],
        ].map(([l, v]) => (
          <div className="card" key={l} style={{ padding: "10px 14px", minWidth: 140, flex: "1 1 140px" }}>
            <div className="muted" style={{ fontSize: 12 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Día a día (14d, sin tus subidas de admin)</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>
            <th style={th}>Día</th><th style={th}>Subidas</th><th style={th}>Personas</th><th style={th}>De Ads</th><th style={th}>Compradas</th><th style={th}>Conversión</th>
          </tr></thead>
          <tbody>
            {dias.length === 0 && <tr><td style={td} colSpan={6} className="muted">Sin subidas aún.</td></tr>}
            {dias.map((d: any) => (
              <tr key={d.dia}>
                <td style={td}>{d.dia}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{d.subidas}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{d.personas}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{d.ads}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{d.compradas}</td>
                <td style={{ ...td, fontWeight: 700 }}>{pct(d.compradas, d.subidas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Últimas 60 subidas</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>
            <th style={th}>Cuándo</th><th style={th}>Quién</th><th style={th}>Tipo</th><th style={th}>Título</th><th style={th}>Dur.</th><th style={th}>Estado</th><th style={th}>Origen</th><th style={th}>Pagada</th><th style={th}>Inicio del texto</th>
          </tr></thead>
          <tbody>
            {filas.map((f) => {
              const esAdmin = f.user?.role === "ADMIN";
              const quien = esAdmin ? "tú (admin)" : (f.user?.email || f.contactEmail || "anónimo");
              return (
                <tr key={f.id} style={esAdmin ? { opacity: 0.5 } : undefined}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fecha(f.createdAt)}</td>
                  <td style={td}>{quien}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{TIPO[f.sourceType] || f.sourceType}</td>
                  <td style={{ ...td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.titulo}>{f.titulo}</td>
                  <td style={td}>{dur(f.duracionSeg)}</td>
                  <td style={td}>{f.status}</td>
                  <td style={td}>{f.origen === "ads" ? "🎯 Ads" : "—"}</td>
                  <td style={td}>{f.locked ? "🔒 no" : "✅ sí"}</td>
                  <td style={{ ...td, maxWidth: 320, color: "var(--ink2)" }}>{(f.preview || "").split(/\s+/).slice(0, 18).join(" ")}{f.preview && f.preview.split(/\s+/).length > 18 ? "…" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12 }}>«Pagada» = desbloqueada por un pago. Tus subidas de admin salen atenuadas y no cuentan en los números de arriba.</p>
      </div>
    </AppShell>
  );
}
