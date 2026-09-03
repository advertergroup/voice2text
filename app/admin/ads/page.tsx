import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs } from "../../../src/ui/AdminTabs.tsx";
import { parseAttr } from "../../../src/lib/attr.ts";

export const dynamic = "force-dynamic";

/**
 * Analítica de Google Ads por campaña y por keyword (utm del PRIMER toque):
 * visitas → subidas → compras → ingresos → suscripciones vivas → meses.
 * Con solo el etiquetado automático de Google llega gclid (fila «google ·
 * sin utm»); campaña y keyword aparecen al poner el sufijo de URL en Ads.
 */

const TZ = "Europe/Madrid";
const SIN_UTM = "google · sin utm";
const usd = (cents: number) => "$" + ((cents || 0) / 100).toFixed(2);
const pct = (parte: number, total: number) => (total > 0 ? ((100 * parte) / total).toFixed(1) + "%" : "—");

interface Fila { visitas: number; unicos: Set<string> | number; subidas: number; compras: number; ingresosCent: number; subsVivas: number; meses: number }
const nueva = (): Fila => ({ visitas: 0, unicos: new Set<string>(), subidas: 0, compras: 0, ingresosCent: 0, subsVivas: 0, meses: 0 });

export default async function Ads() {
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const prisma = await getPrisma();
  const desde = new Date(Date.now() - 30 * 864e5);

  const porCampana = new Map<string, Fila>();
  const porKeyword = new Map<string, Fila>();
  const fila = (m: Map<string, Fila>, k: string) => { if (!m.has(k)) m.set(k, nueva()); return m.get(k)!; };

  // 1) Visitas: pageviews de ads (o con utm) del periodo; la campaña sale de la
  //    query guardada en meta (captura activa desde el 03-09).
  const pvs = await prisma.evento.findMany({
    where: { tipo: "pageview", createdAt: { gte: desde }, OR: [{ origen: "ads" }, { meta: { contains: "utm_" } }] },
    select: { vid: true, meta: true }, take: 5000,
  });
  for (const p of pvs) {
    const a = parseAttr(p.meta);
    if (!a.source && !p.meta) { /* llegada ads sin query guardada (antes del 03-09) */ }
    const camp = a.campaign || SIN_UTM;
    const f = fila(porCampana, camp);
    f.visitas++; (f.unicos as Set<string>).add(p.vid || "?");
    if (a.term) { const k = fila(porKeyword, a.term); k.visitas++; (k.unicos as Set<string>).add(p.vid || "?"); }
  }

  // 2) Subidas por campaña/keyword (las del admin fuera).
  const subidas = await prisma.$queryRawUnsafe<any[]>(`
    select coalesce(t."utmCampaign", '${SIN_UTM}') as campana, t."utmTerm" as kw, count(*)::int as n
      from "Transcription" t left join "User" u on u.id = t."userId"
     where t."createdAt" > now() - interval '30 days' and (t.origen = 'ads' or t."utmCampaign" is not null)
       and coalesce(u.role::text,'') <> 'ADMIN'
     group by 1, 2`);
  for (const s of subidas) {
    fila(porCampana, s.campana).subidas += s.n;
    if (s.kw) fila(porKeyword, s.kw).subidas += s.n;
  }

  // 3) Dinero y suscripciones: usuarios con atribución (fijada al pagar) +
  //    sus eventos purchase/upgrade. Meses aprox: desde el alta hasta hoy (o
  //    hasta el fin de periodo si canceló), en bloques de 30 días.
  const clientes = await prisma.user.findMany({
    where: { utmSource: { not: null }, role: { not: "ADMIN" } },
    select: { id: true, utmCampaign: true, utmTerm: true, subStatus: true, createdAt: true, currentPeriodEnd: true },
  });
  const eventosDinero = clientes.length ? await prisma.evento.findMany({
    where: { tipo: { in: ["purchase", "upgrade"] }, userId: { in: clientes.map((u) => u.id) } },
    select: { userId: true, tipo: true, valorCent: true },
  }) : [];
  for (const u of clientes) {
    const viva = u.subStatus === "TRIAL" || u.subStatus === "ACTIVE" || u.subStatus === "PAST_DUE";
    const fin = u.subStatus === "CANCELED" ? (u.currentPeriodEnd ?? new Date()) : new Date();
    const meses = Math.max(0, (Math.min(Date.now(), fin.getTime()) - u.createdAt.getTime()) / (30 * 864e5));
    const mios = eventosDinero.filter((e) => e.userId === u.id);
    const ingresos = mios.reduce((a, e) => a + (e.valorCent || 0), 0);
    const compras = mios.filter((e) => e.tipo === "purchase").length;
    for (const [m, clave] of [[porCampana, u.utmCampaign || SIN_UTM], [porKeyword, u.utmTerm]] as const) {
      if (!clave) continue;
      const f = fila(m, clave);
      f.compras += compras; f.ingresosCent += ingresos; f.subsVivas += viva ? 1 : 0; f.meses += meses;
    }
  }

  // Últimas llegadas con parámetros (prueba viva de qué manda Google).
  const llegadas = await prisma.$queryRawUnsafe<any[]>(`
    select "createdAt" as cuando, path, meta from "Evento"
     where tipo = 'pageview' and origen = 'ads' and meta is not null
     order by "createdAt" desc limit 12`);

  const td = { padding: "6px 8px", borderBottom: "1px solid var(--border)", fontSize: 13 } as const;
  const th = { ...td, fontWeight: 700, whiteSpace: "nowrap" as const };
  const num = { ...td, fontVariantNumeric: "tabular-nums" as const, textAlign: "right" as const };

  const tabla = (titulo: string, m: Map<string, Fila>, etiqueta: string) => {
    const filas = [...m.entries()].sort((a, b) => b[1].ingresosCent - a[1].ingresosCent || b[1].visitas - a[1].visitas);
    return (
      <div className="card" style={{ marginBottom: 18, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>{titulo}</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>{etiqueta}</th><th style={th}>Visitas</th><th style={th}>Únicos</th><th style={th}>Subidas</th><th style={th}>Compras</th><th style={th}>Conv. visita→compra</th><th style={th}>Ingresos</th><th style={th}>Subs vivas</th><th style={th}>Meses acum.*</th>
          </tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td style={td} colSpan={9} className="muted">Sin datos todavía.</td></tr>}
            {filas.map(([k, f]) => {
              const unicos = f.unicos instanceof Set ? f.unicos.size : Number(f.unicos);
              return (
                <tr key={k}>
                  <td style={{ ...td, fontFamily: k === SIN_UTM ? undefined : "monospace", fontSize: 12.5 }}>{k}</td>
                  <td style={num}>{f.visitas}</td><td style={num}>{unicos}</td><td style={num}>{f.subidas}</td>
                  <td style={num}>{f.compras}</td><td style={num}>{pct(f.compras, unicos)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{usd(f.ingresosCent)}</td>
                  <td style={num}>{f.subsVivas}</td><td style={num}>{f.meses.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Google Ads · atribución</h1>
      <AdminTabs active="ads" />

      {tabla("Por campaña · 30 días", porCampana, "Campaña")}
      {tabla("Por keyword (utm_term) · 30 días", porKeyword, "Keyword")}

      <div className="card" style={{ marginBottom: 18, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Últimas llegadas de Ads · parámetros reales</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
          {llegadas.length === 0 && <tr><td style={td} className="muted">Aún ninguna con parámetros guardados (captura activa desde el 03-09).</td></tr>}
          {llegadas.map((r: any, i: number) => (
            <tr key={i}>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(r.cuando).toLocaleString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              <td style={td}>{r.path}</td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{r.meta}</td>
            </tr>
          ))}
        </tbody></table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Para tener campaña y keyword con nombre</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Google solo manda <code>gclid</code> por defecto (fila «{SIN_UTM}»). Para el desglose real, pega esto en
          Google Ads → tu campaña → <strong>Configuración → Opciones de URL de la campaña → Sufijo de la URL final</strong>:
        </p>
        <pre style={{ background: "var(--bg2, #f1f5f9)", padding: 12, borderRadius: 8, fontSize: 12.5, overflowX: "auto" }}>utm_source=google&utm_medium=cpc&utm_campaign=voice2text-search&utm_term={"{keyword}"}&utm_content={"{creative}"}</pre>
        <p className="muted" style={{ fontSize: 12 }}>
          {"{keyword}"} y {"{creative}"} los sustituye Google en cada clic. * Meses acumulados: aproximación (bloques de 30 días desde el alta; el dinero exacto está en Stripe).
        </p>
      </div>
    </AppShell>
  );
}
