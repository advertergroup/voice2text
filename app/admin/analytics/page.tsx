import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs } from "../../../src/ui/AdminTabs.tsx";
import { tieneStripe, getStripe } from "../../../src/lib/stripe.ts";

export const dynamic = "force-dynamic";

/** Analítica del funnel completo: visitas → subidas → checkout → oferta → compra $0.99 → upgrade $49.99 + Stripe/soporte/recuperación. */

const TZ = "Europe/Madrid";
const diaTZ = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD

interface Dia {
  d: string;
  pv: number; uniq: number; uniqAds: number;           // visitas
  payUniq: number;                                     // checkout (únicos en /pay)
  subidas: number; subidasAds: number; mic: number; url: number; manual: number;
  offerShown: number; offerAccepted: number;
  compras: number; comprasAds: number; comprasCents: number;
  upgrades: number; upgradesCents: number;
  brutoStripe: number; reembolsosStripe: number;       // céntimos, de Stripe
}

const nuevoDia = (d: string): Dia => ({ d, pv: 0, uniq: 0, uniqAds: 0, payUniq: 0, subidas: 0, subidasAds: 0, mic: 0, url: 0, manual: 0, offerShown: 0, offerAccepted: 0, compras: 0, comprasAds: 0, comprasCents: 0, upgrades: 0, upgradesCents: 0, brutoStripe: 0, reembolsosStripe: 0 });

const usd = (cents: number) => "$" + (cents / 100).toFixed(2);
const pct = (parte: number, total: number) => (total > 0 ? ((100 * parte) / total).toFixed(1) + "%" : "—");

export default async function Analytics() {
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const prisma = await getPrisma();

  // Últimos 30 días (zona horaria de Madrid), de hoy hacia atrás.
  const dias = new Map<string, Dia>();
  for (let i = 0; i < 30; i++) { const k = diaTZ(new Date(Date.now() - i * 864e5)); if (!dias.has(k)) dias.set(k, nuevoDia(k)); }
  const dia = (k: string) => { if (!dias.has(k)) dias.set(k, nuevoDia(k)); return dias.get(k)!; };

  // Visitas (pageviews del middleware; excluye admin/dashboard/login/account).
  const pvRows = await prisma.$queryRawUnsafe<any[]>(`
    select to_char(("createdAt" at time zone 'Europe/Madrid')::date, 'YYYY-MM-DD') as d,
           count(*)::int as pv,
           count(distinct vid)::int as uniq,
           count(distinct vid) filter (where origen = 'ads')::int as uniq_ads,
           count(distinct vid) filter (where path = '/pay')::int as pay_uniq
    from "Evento"
    where tipo = 'pageview' and "createdAt" > now() - interval '30 days'
      and (path is null or path !~ '^/(admin|dashboard|login|account)')
    group by 1`);
  for (const r of pvRows) { const x = dia(r.d); x.pv = r.pv; x.uniq = r.uniq; x.uniqAds = r.uniq_ads; x.payUniq = r.pay_uniq; }

  // Eventos del funnel.
  const evRows = await prisma.$queryRawUnsafe<any[]>(`
    select to_char(("createdAt" at time zone 'Europe/Madrid')::date, 'YYYY-MM-DD') as d, tipo,
           count(*)::int as n,
           count(*) filter (where origen = 'ads')::int as n_ads,
           coalesce(sum("valorCent"), 0)::int as cents
    from "Evento"
    where tipo in ('offer_shown','offer_accepted','purchase','upgrade') and "createdAt" > now() - interval '30 days'
    group by 1, 2`);
  for (const r of evRows) {
    const x = dia(r.d);
    if (r.tipo === "offer_shown") x.offerShown = r.n;
    if (r.tipo === "offer_accepted") x.offerAccepted = r.n;
    if (r.tipo === "purchase") { x.compras = r.n; x.comprasAds = r.n_ads; x.comprasCents = r.cents; }
    if (r.tipo === "upgrade") { x.upgrades = r.n; x.upgradesCents = r.cents; }
  }

  // Subidas (transcripciones) por día, tipo y origen.
  const trRows = await prisma.$queryRawUnsafe<any[]>(`
    select to_char(("createdAt" at time zone 'Europe/Madrid')::date, 'YYYY-MM-DD') as d,
           count(*)::int as subidas,
           count(*) filter (where origen = 'ads')::int as subidas_ads,
           count(*) filter (where "sourceType"::text = 'MIC')::int as mic,
           count(*) filter (where "sourceType"::text = 'URL')::int as url,
           count(*) filter (where status::text = 'MANUAL')::int as manual
    from "Transcription"
    where "createdAt" > now() - interval '30 days'
    group by 1`);
  for (const r of trRows) { const x = dia(r.d); x.subidas = r.subidas; x.subidasAds = r.subidas_ads; x.mic = r.mic; x.url = r.url; x.manual = r.manual; }

  // Stripe en vivo: cargos/reembolsos por día + suscripciones.
  let stripeOk = false;
  let subsTrial = 0, subsActive = 0, subsCanceled = 0;
  if (tieneStripe()) {
    try {
      const stripe = await getStripe();
      const charges = await stripe.charges.list({ limit: 100 });
      for (const ch of charges.data || []) {
        const k = diaTZ(new Date(ch.created * 1000));
        if (!dias.has(k)) continue; // fuera de los 30 días
        const x = dia(k);
        if (ch.status === "succeeded") { x.brutoStripe += ch.amount; x.reembolsosStripe += ch.amount_refunded || 0; }
      }
      const subs = await stripe.subscriptions.list({ status: "all", limit: 100 });
      for (const s of subs.data || []) {
        if (s.status === "trialing") subsTrial++;
        else if (s.status === "active" || s.status === "past_due") subsActive++;
        else subsCanceled++;
      }
      stripeOk = true;
    } catch { /* panel sin Stripe si la API falla */ }
  }

  // Soporte (7 días) y recuperación.
  const soporte = await prisma.$queryRawUnsafe<any[]>(`
    select accion, count(*)::int as n from "SupportLog"
    where "createdAt" > now() - interval '7 days' group by 1 order by 2 desc`);
  const recovery = await prisma.$queryRawUnsafe<any[]>(`
    select "recoveryStage" as stage, count(*)::int as n from "Transcription"
    where "recoveryStage" > 0 and "createdAt" > now() - interval '30 days' group by 1 order by 1`);

  // Únicos reales por ventana (la suma de únicos diarios sobreconta a quien vuelve).
  const uniqRows = await prisma.$queryRawUnsafe<any[]>(`
    select count(distinct vid) filter (where "createdAt" > now() - interval '7 days')::int as u7,
           count(distinct vid) filter (where "createdAt" > now() - interval '7 days' and origen = 'ads')::int as u7_ads,
           count(distinct vid)::int as u30,
           count(distinct vid) filter (where origen = 'ads')::int as u30_ads
    from "Evento"
    where tipo = 'pageview' and "createdAt" > now() - interval '30 days'
      and (path is null or path !~ '^/(admin|dashboard|login|account)')`);
  const uniqVentana = uniqRows[0] || { u7: 0, u7_ads: 0, u30: 0, u30_ads: 0 };

  // Agregados.
  const orden = [...dias.values()].sort((a, b) => (a.d < b.d ? 1 : -1)); // hoy primero
  const suma = (n: number): Dia => {
    const acc = nuevoDia("");
    for (const x of orden.slice(0, n)) {
      acc.pv += x.pv; acc.uniq += x.uniq; acc.uniqAds += x.uniqAds; acc.payUniq += x.payUniq;
      acc.subidas += x.subidas; acc.subidasAds += x.subidasAds; acc.mic += x.mic; acc.url += x.url; acc.manual += x.manual;
      acc.offerShown += x.offerShown; acc.offerAccepted += x.offerAccepted;
      acc.compras += x.compras; acc.comprasAds += x.comprasAds; acc.comprasCents += x.comprasCents;
      acc.upgrades += x.upgrades; acc.upgradesCents += x.upgradesCents;
      acc.brutoStripe += x.brutoStripe; acc.reembolsosStripe += x.reembolsosStripe;
    }
    return acc;
  };
  const hoy = orden[0] ?? nuevoDia("");
  const s7 = suma(7), s30 = suma(30);
  s7.uniq = uniqVentana.u7; s7.uniqAds = uniqVentana.u7_ads;
  s30.uniq = uniqVentana.u30; s30.uniqAds = uniqVentana.u30_ads;
  const mrr = subsActive * 4999;

  const th = { textAlign: "right" as const, padding: "6px 8px", borderBottom: "2px solid var(--border)", fontSize: 12, whiteSpace: "nowrap" as const };
  const td = { textAlign: "right" as const, padding: "5px 8px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" as const, fontSize: 13, whiteSpace: "nowrap" as const };
  const kpi = (label: string, valor: string, sub?: string) => (
    <div className="card" style={{ padding: "12px 16px", minWidth: 150, flex: "1 1 150px" }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{valor}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );

  const funnel: [string, number][] = [
    ["Visitantes únicos", s30.uniq],
    ["Suben o graban algo", s30.subidas],
    ["Llegan al checkout", s30.payUniq],
    ["Compran ($0.99 → prueba 7d)", s30.compras],
    ["Pasan al plan de $49.99", s30.upgrades + subsActive],
  ];
  const maxFunnel = Math.max(1, ...funnel.map(([, n]) => n));

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Analítica</h1>
      <AdminTabs active="analytics" />
      <p className="muted" style={{ fontSize: 13 }}>
        Zona horaria: Madrid · Visitas medidas desde el 28-08-2026 (sin bots ni páginas de admin) · «Ads» = llegó con gclid de Google Ads (cookie de 30 días).
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "14px 0" }}>
        {kpi("Visitantes hoy", String(hoy.uniq), `${hoy.pv} páginas vistas · ${hoy.uniqAds} de Ads`)}
        {kpi("Visitantes 7 días", String(s7.uniq), `${s7.uniqAds} de Ads`)}
        {kpi("Subidas 7 días", String(s7.subidas), `${pct(s7.subidas, s7.uniq)} de los visitantes`)}
        {kpi("Compras 7 días", String(s7.compras), `${pct(s7.compras, s7.payUniq)} del checkout`)}
        {kpi("Ingresos 30 días", usd(stripeOk ? s30.brutoStripe : s30.comprasCents + s30.upgradesCents), stripeOk ? `reembolsado ${usd(s30.reembolsosStripe)}` : "según eventos (Stripe no disponible)")}
        {kpi("Suscripciones", `${subsTrial} en prueba · ${subsActive} activas`, `MRR ${usd(mrr)} · ${subsCanceled} bajas`)}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Funnel · últimos 30 días</h3>
        {funnel.map(([label, n], i) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "220px 1fr 120px", gap: 10, alignItems: "center", margin: "6px 0" }}>
            <div style={{ fontSize: 13 }}>{label}</div>
            <div style={{ background: "var(--bg2)", borderRadius: 6, overflow: "hidden", height: 18 }}>
              <div style={{ width: `${Math.max(2, (100 * n) / maxFunnel)}%`, height: "100%", background: "linear-gradient(90deg,#4f46e5,#7c3aed)", opacity: 0.9 }} />
            </div>
            <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              <b>{n}</b>{i > 0 && funnel[i - 1][1] > 0 && <span className="muted"> · {pct(n, funnel[i - 1][1])}</span>}
            </div>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>El último paso incluye las suscripciones ya activas en Stripe. La métrica que decide la rentabilidad: compras→plan mensual (objetivo ≥ 1 de cada 10).</p>
      </div>

      <div className="card" style={{ marginBottom: 18, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Día a día · últimos 14 días</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>Día</th>
            <th style={th}>Visitantes</th><th style={th}>· Ads</th><th style={th}>Páginas</th>
            <th style={th}>Subidas</th><th style={th}>· Ads</th><th style={th}>· Micro</th><th style={th}>· URL</th><th style={th}>· Manual</th>
            <th style={th}>Checkout</th><th style={th}>Oferta vista</th><th style={th}>· Aceptada</th>
            <th style={th}>Compras</th><th style={th}>· Ads</th><th style={th}>Upgrades</th>
            <th style={th}>Ingresos</th>{stripeOk && <th style={th}>Reembolsos</th>}
          </tr></thead>
          <tbody>
            {orden.slice(0, 14).map((x) => (
              <tr key={x.d}>
                <td style={{ ...td, textAlign: "left" }}>{x.d.slice(5)}</td>
                <td style={td}>{x.uniq}</td><td style={td}>{x.uniqAds}</td><td style={td}>{x.pv}</td>
                <td style={td}><b>{x.subidas}</b></td><td style={td}>{x.subidasAds}</td><td style={td}>{x.mic}</td><td style={td}>{x.url}</td><td style={td}>{x.manual}</td>
                <td style={td}>{x.payUniq}</td><td style={td}>{x.offerShown}</td><td style={td}>{x.offerAccepted}</td>
                <td style={td}><b>{x.compras}</b></td><td style={td}>{x.comprasAds}</td><td style={td}>{x.upgrades}</td>
                <td style={td}>{usd(stripeOk ? x.brutoStripe : x.comprasCents + x.upgradesCents)}</td>
                {stripeOk && <td style={td}>{x.reembolsosStripe ? usd(x.reembolsosStripe) : "—"}</td>}
              </tr>
            ))}
            <tr>
              <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>30 días</td>
              <td style={td}><b>{s30.uniq}</b></td><td style={td}>{s30.uniqAds}</td><td style={td}>{s30.pv}</td>
              <td style={td}><b>{s30.subidas}</b></td><td style={td}>{s30.subidasAds}</td><td style={td}>{s30.mic}</td><td style={td}>{s30.url}</td><td style={td}>{s30.manual}</td>
              <td style={td}>{s30.payUniq}</td><td style={td}>{s30.offerShown}</td><td style={td}>{s30.offerAccepted}</td>
              <td style={td}><b>{s30.compras}</b></td><td style={td}>{s30.comprasAds}</td><td style={td}>{s30.upgrades}</td>
              <td style={td}><b>{usd(stripeOk ? s30.brutoStripe : s30.comprasCents + s30.upgradesCents)}</b></td>
              {stripeOk && <td style={td}>{usd(s30.reembolsosStripe)}</td>}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3 style={{ marginTop: 0 }}>Soporte automático · 7 días</h3>
          {soporte.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Sin actividad.</p>}
          <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
            {soporte.map((r: any) => (
              <tr key={r.accion}><td style={{ ...td, textAlign: "left" }}>{r.accion}</td><td style={td}>{r.n}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3 style={{ marginTop: 0 }}>Emails de recuperación · 30 días</h3>
          {recovery.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Ninguno enviado aún.</p>}
          <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
            {recovery.map((r: any) => (
              <tr key={r.stage}><td style={{ ...td, textAlign: "left" }}>{["", "1h «lista para desbloquear»", "8h recordatorio", "24h «se borra en 12h»"][r.stage] || `etapa ${r.stage}`}</td><td style={td}>{r.n}</td></tr>
            ))}
          </tbody></table>
          <p className="muted" style={{ fontSize: 12 }}>Transcripciones que alcanzaron cada etapa (la etapa incluye las anteriores).</p>
        </div>
      </div>
    </AppShell>
  );
}
