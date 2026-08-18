import type { UIStrings } from "../lib/ui.ts";

const f = (str: string, vars: Record<string, string>) => Object.keys(vars).reduce((a, k) => a.replaceAll(`{${k}}`, vars[k]!), str);

/** Aviso de cuota gratuita agotada: para transcribir más hay que activar el plan. */
export function QuotaBanner({ s, todayLabel, features }: { s: UIStrings; todayLabel: string; features: string[] }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 36, borderColor: "var(--accent)", boxShadow: "0 12px 32px rgba(79,70,229,.12)" }}>
      <div style={{ fontSize: 36 }}>🚀</div>
      <h3 style={{ margin: "12px 0 6px", fontSize: 21 }}>{s.quota_title}</h3>
      <p className="muted" style={{ maxWidth: 480, margin: "0 auto 16px" }}>{s.quota_desc}</p>
      {features.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 auto 20px", maxWidth: 380, textAlign: "left" }}>
          {features.map((x, i) => (
            <li key={i} style={{ padding: "5px 0 5px 26px", position: "relative", color: "var(--ink2)", fontSize: 14.5 }}>
              <span style={{ position: "absolute", left: 0, color: "var(--good)", fontWeight: 800 }}>✓</span>{x}
            </li>
          ))}
        </ul>
      )}
      <a href="/pay" className="btn btn-primary btn-lg">{f(s.quota_cta!, { today: todayLabel })}</a>
    </div>
  );
}
