#!/usr/bin/env node
/**
 * Auditoría de mezcla de idiomas en PRODUCCIÓN: descarga cada página pública en cada idioma y busca palabras
 * características de OTROS idiomas en el texto visible. Es el tercer candado (los otros dos son los tests:
 * diccionario completo y cero literales en el JSX). Se ejecuta tras cada despliegue:
 *
 *   node scripts/audit-i18n.mjs https://voicetotexts.net            → sitemap + rutas comunes en todos los idiomas
 *   node scripts/audit-i18n.mjs https://getwalink.com /pricing /faq  → rutas explícitas (se prueban en cada idioma)
 *
 * Sale con código 1 si alguna página mezcla idiomas. Falsos positivos conocidos: ninguno con las listas actuales;
 * si aparece uno, añade la palabra al par correspondiente de ALLOW (no quites el marcador).
 */
const BASE = (process.argv[2] || "").replace(/\/$/, "");
if (!BASE) { console.error("uso: node scripts/audit-i18n.mjs https://dominio [rutas…]"); process.exit(2); }
const LOCALES = ["es", "en", "pt", "fr", "de", "it", "nl", "pl", "el"];
const DEFAULT = "es";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 audit-i18n";

// Marcadores por idioma: expresiones regulares sobre el texto visible en minúsculas (\b = límite de palabra).
const W = (arr) => arr.map((w) => new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
const MARK = {
  es: W(["los primeros", "luego", "días", "prueba", "gratis", "cancela", "cuando quieras", "permanencia", "tarjeta", "suscripción", "ahora", "comenzar", "empezar", "desbloquea", "transcripción", "subir", "archivo", "precio", "cada mes", "y", "con", "para", "sin", "del", "las", "tus", "una", "cómo", "qué", "aquí", "también", "más"]).concat([/\/mes\b/]),
  en: W(["the", "your", "and", "with", "month", "cancel anytime", "unlimited", "go premium", "free", "upload", "file", "start", "now", "get", "you"]).concat([/\/month\b/]),
  pt: W(["você", "seu", "sua", "grátis", "não", "também", "então", "cartão", "assinatura", "começar", "mês", "agora", "teste"]).concat([/\/mês\b/]),
  it: W(["il", "della", "gratis", "subito", "ora", "mese", "carta", "abbonamento", "prova", "anche", "perché", "sblocca"]).concat([/\/mese\b/]),
  de: W(["die", "der", "und", "mit", "monat", "jetzt", "kostenlos", "karte", "abo", "sie", "ihre", "datei", "hochladen", "jederzeit", "freischalten"]).concat([/\/monat\b/]),
  pl: W(["i", "z", "na", "miesiąc", "teraz", "za darmo", "karta", "plik", "prześlij", "odblokuj"]).concat([/subskrypc/, /\/mies\b/]),
  el: W(["και", "μήνα", "τώρα", "δωρεάν", "σας", "την", "του", "με"]),
  fr: W(["le", "les", "des", "vous", "votre", "avec", "mois", "gratuit", "maintenant", "carte", "abonnement", "fichier", "télécharger", "débloquer", "puis"]).concat([/\/mois\b/]),
  nl: W(["de", "het", "een", "met", "maand", "gratis", "nu", "kaart", "abonnement", "bestand", "uploaden", "ontgrendel", "daarna"]).concat([/\/maand\b/]),
};
// Palabras de un idioma que también son normales en otro: [página, marcador] → palabras a ignorar.
const ROM = ["y", "con", "para", "sin", "del", "las", "una", "tus", "más", "gratis", "cancela", "precio", "ahora"];
const ALLOW = {
  "en:es": ROM, "es:en": ["now", "file", "get", "you", "start"],
  "pt:es": ROM.concat(["prueba", "subir", "archivo", "precio", "transcripción"]), "es:pt": ["mês", "agora", "então"],
  "it:es": ROM, "es:it": ["ora", "gratis", "anche", "il"],
  "de:es": ROM, "pl:es": ROM, "el:es": ROM, "fr:es": ROM, "nl:es": ROM,
  "it:en": ["file", "now", "start", "get"], "de:en": ["file", "now", "start", "get"], "pl:en": ["file", "now", "start", "get"], "el:en": ["file", "now", "start", "get"],
  "pt:en": ["file", "now", "start", "get", "you"], "fr:en": ["file", "now", "start", "get", "the"], "nl:en": ["file", "now", "start", "get"],
  "en:it": ["ora", "il"], "en:de": ["die", "der"], "en:pl": ["i", "z", "na"], "en:pt": ["agora"], "en:fr": ["le", "les", "des"], "en:nl": ["de", "het", "een", "met", "nu"],
  "es:fr": ["le", "les", "des", "puis"], "es:nl": ["de", "het", "een", "met", "nu"], "es:pl": ["i", "z", "na"],
  "it:fr": ["le", "les", "des"], "it:nl": ["de", "het", "een", "met", "nu"], "fr:it": ["il", "ora"], "nl:it": ["il", "ora"],
  "de:nl": ["de", "het", "een", "met", "nu"], "nl:de": ["die", "der", "und", "mit"], "de:fr": ["le", "les", "des"], "fr:de": ["die", "der"],
  "pl:nl": ["de", "het", "een", "met", "nu"], "pt:fr": ["le", "les", "des"], "pt:nl": ["de", "het", "een", "met", "nu"], "fr:nl": ["de", "het", "een", "met", "nu"], "nl:fr": ["le", "les", "des"],
  "fr:pl": ["i", "z", "na"], "nl:pl": ["i", "z", "na"], "de:pl": ["i", "z", "na"], "it:pl": ["i", "z", "na"], "pt:pl": ["i", "z", "na"], "el:pl": ["i", "z", "na"],
  "fr:nl_abo": [], "de:fr": ["le", "les", "des", "abonnement"], "de:nl": ["de", "het", "een", "met", "nu", "abonnement"],
};
// Idiomas cuyos legales se sirven a propósito en inglés (sin traducción propia).
const LEGAL_EN = { el: [/\/(terms|privacy|refund|help)$/] };
const LANG_NAMES = ["Español", "English", "Português", "Français", "Deutsch", "Italiano", "Nederlands", "Polski", "Ελληνικά"];

const localeOf = (p) => (p.match(/^\/(en|es|pt|it|de|pl|el|fr|nl)(\/|$)/) || [])[1];
async function fetchPage(url, al) {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": al }, redirect: "manual" });
  return { status: r.status, location: r.headers.get("location"), html: r.status === 200 ? await r.text() : "" };
}
function visible(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, " ");
  const lang = (t.match(/<html[^>]*lang="([a-zA-Z-]+)"/) || [])[1]?.split("-")[0]?.toLowerCase();
  t = t.replace(/<[^>]+>/g, " ").replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " })[m]);
  for (const n of LANG_NAMES) t = t.split(n).join(" ");
  return { lang, text: " " + t.replace(/\s+/g, " ") + " " };
}
function audit(path, { status, location, html }) {
  if (status !== 200) return [`HTTP ${status}${location ? " → " + location : ""}`];
  const { lang, text } = visible(html);
  const loc = localeOf(path) || (LOCALES.includes(lang) ? lang : DEFAULT);
  const low = text.toLowerCase();
  const out = [];
  for (const [other, marks] of Object.entries(MARK)) {
    if (other === loc) continue;
    if (other === "en" && LEGAL_EN[loc]?.some((re) => re.test(path))) continue;
    const allow = new Set(ALLOW[`${loc}:${other}`] || []);
    const hits = [];
    for (const re of marks) {
      const word = re.source.replace(/\\b/g, "").replace(/\\/g, "");
      if (allow.has(word)) continue;
      const m = low.match(re);
      if (m) hits.push(`«${word}» ${text.slice(Math.max(0, m.index - 28), m.index + word.length + 28).trim()}`);
    }
    const min = other === "es" ? 1 : 2; // el español es el idioma base: una sola palabra ya delata la mezcla
    if (hits.length >= min) out.push(`${other}: ${hits.slice(0, 3).join(" | ")}`);
  }
  return out;
}

const extra = process.argv.slice(3);
let paths = [];
try {
  const xml = await (await fetch(BASE + "/sitemap.xml", { headers: { "user-agent": UA } })).text();
  paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/");
} catch { /* sin sitemap */ }
const common = extra.length ? extra : ["/", "/pricing", "/faq", "/login", "/register", "/terms", "/privacy", "/refund"];
for (const l of LOCALES) for (const p of common) paths.push((l === DEFAULT ? "" : "/" + l) + (p === "/" ? (l === DEFAULT ? "/" : "") : p));
paths = [...new Set(paths)].sort();

let bad = 0, checked = 0;
for (const p of paths) {
  let res;
  try { res = await fetchPage(BASE + p, localeOf(p) || DEFAULT); } catch (e) { console.log(`✖ ${p} [error ${e.message}]`); bad++; continue; }
  if (res.status === 404) continue; // ruta que no existe en ese idioma: no es mezcla
  checked++;
  const problems = audit(p, res);
  if (problems.length) { bad++; console.log(`✖ ${p}\n   ${problems.join("\n   ")}`); }
}
console.log(`\n${checked} páginas comprobadas en ${BASE} · ${bad} con mezcla de idiomas`);
process.exit(bad ? 1 : 0);
