import { LOCALES, DEFAULT_LOCALE } from "../lib/locale.ts";
import { MarcaInterno } from "./MarcaInterno.tsx";

export function AdminTabs({ active, lang = DEFAULT_LOCALE }: { active: string; lang?: string }) {
  const q = lang && lang !== DEFAULT_LOCALE ? `?lang=${lang}` : "";
  const tabs = [["/admin", "Textos y marca", "textos"], ["/admin/plans", "Planes/Precios", "plans"], ["/admin/faq", "FAQ", "faq"], ["/admin/landings", "Landings SEO", "landings"], ["/admin/manual", "⏳ Cola manual", "manual"], ["/admin/analytics", "📊 Analítica", "analytics"], ["/admin/heatmap", "🖱️ Mapa de calor", "heatmap"], ["/admin/subidas", "📤 Subidas", "subidas"]];
  return (
    <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 20, flexWrap: "wrap" }}>
      <MarcaInterno />
      {tabs.map(([href, label, key]) => (
        <a key={key} href={href + q} style={{ padding: "10px 16px", fontWeight: 600, fontSize: 15, borderBottom: active === key ? "2px solid var(--accent)" : "2px solid transparent", color: active === key ? "var(--accent)" : "var(--ink2)" }}>{label}</a>
      ))}
    </div>
  );
}

/** Barra de idioma del admin: cambia qué idioma se está editando (?lang=xx). */
export function AdminLangBar({ base, lang }: { base: string; lang: string }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
      <span className="muted" style={{ fontSize: 13, marginRight: 4, fontWeight: 600 }}>🌐 Editando idioma:</span>
      {LOCALES.map((l) => {
        const q = l.code === DEFAULT_LOCALE ? "" : `?lang=${l.code}`;
        const on = l.code === lang;
        return (
          <a key={l.code} href={base + q}
             style={{ padding: "5px 11px", borderRadius: 7, fontSize: 13, fontWeight: on ? 700 : 500, border: "1px solid " + (on ? "var(--accent)" : "var(--border)"), color: on ? "var(--accent)" : "var(--ink2)", background: on ? "var(--accent-soft, #eef2ff)" : "transparent", textDecoration: "none" }}>
            {l.flag} {l.code.toUpperCase()}
          </a>
        );
      })}
    </div>
  );
}
