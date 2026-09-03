/**
 * Atribución de primer toque. La cookie v2t_attr guarda la query string de la
 * PRIMERA llegada con utm_* o gclid (90 días); aquí se convierte en campos.
 * Google Ads con etiquetado automático solo manda gclid → source "google" sin
 * campaña; con el sufijo de URL (utm_campaign={campaignid}&utm_term={keyword})
 * llegan también campaña y keyword.
 */
export function parseAttr(q: string | undefined | null): { source: string | null; campaign: string | null; term: string | null; content: string | null } {
  const out: { source: string | null; campaign: string | null; term: string | null; content: string | null } = { source: null, campaign: null, term: null, content: null };
  if (!q || typeof q !== "string") return out;
  try {
    const sp = new URLSearchParams(q.startsWith("?") ? q.slice(1) : q);
    const g = (k: string) => { const v = (sp.get(k) || "").trim().slice(0, 80); return v || null; };
    out.source = g("utm_source");
    out.campaign = g("utm_campaign");
    out.term = g("utm_term");
    out.content = g("utm_content");
    if (!out.source && (sp.has("gclid") || sp.has("gad_source"))) out.source = "google";
  } catch { /* query rota: sin atribución */ }
  return out;
}
