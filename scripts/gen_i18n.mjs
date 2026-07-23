// Genera src/lib/translations.generated.ts a partir del resultado del workflow de traducción.
// Decodifica entidades HTML (&amp; &lt; &gt; …) que introdujo la salida estructurada.
import fs from "node:fs";
import path from "node:path";

const OUT_FILE = process.argv[2];
if (!OUT_FILE) { console.error("uso: node gen_i18n.mjs <workflow-output.json>"); process.exit(1); }

const raw = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
const result = raw.result || raw; // el workflow devuelve {en,pt,...} en .result

function decodeEntities(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&"); // amp al final para no recrear entidades
}
function deep(v) {
  if (typeof v === "string") return decodeEntities(v);
  if (Array.isArray(v)) return v.map(deep);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = deep(v[k]); return o; }
  return v;
}

const clean = deep(result);
const locales = Object.keys(clean);

const content = {};   // { locale: { key: value } }
const plans = {};     // { locale: { planKey: {nombre,badge,botonTexto,descripcion,caracteristicas[]} } }
const faqs = {};      // { locale: { orden: {pregunta,respuesta} } }
const landings = {};  // { locale: { slug: {titulo,subtitulo,cuerpo,metaDesc} } }

for (const loc of locales) {
  const d = clean[loc] || {};
  content[loc] = d.content || {};
  plans[loc] = d.plans || {};
  faqs[loc] = d.faqs || {};
  landings[loc] = d.landings || {};
}

const banner = `// AUTOGENERADO por scripts/gen_i18n.mjs — NO editar a mano.\n// Traducciones por defecto (marketing nativo) para los idiomas != es.\n// El admin puede sobreescribirlas por idioma en la BD (SiteContent/Plan/FaqItem/LandingPage).\n`;
const body =
  banner +
  `\nexport const TRANSLATIONS: Record<string, Record<string, string>> = ${JSON.stringify(content, null, 2)};\n` +
  `\nexport const I18N_PLANS: Record<string, Record<string, { nombre: string; badge: string; botonTexto: string; descripcion: string; caracteristicas: string[] }>> = ${JSON.stringify(plans, null, 2)};\n` +
  `\nexport const I18N_FAQS: Record<string, Record<string, { pregunta: string; respuesta: string }>> = ${JSON.stringify(faqs, null, 2)};\n` +
  `\nexport const I18N_LANDINGS: Record<string, Record<string, { titulo: string; subtitulo: string; cuerpo: string; metaDesc: string }>> = ${JSON.stringify(landings, null, 2)};\n`;

const dest = path.join(process.cwd(), "src", "lib", "translations.generated.ts");
fs.writeFileSync(dest, body, "utf8");
console.log(`✅ Generado ${dest}`);
console.log(`   idiomas: ${locales.join(", ")}`);
console.log(`   claves content/idioma: ${Object.keys(content[locales[0]] || {}).length}`);
// muestra de control (idioma con acentos)
const sampleLoc = locales.includes("fr") ? "fr" : locales[0];
console.log(`   muestra ${sampleLoc} hero.title: ${JSON.stringify(content[sampleLoc]?.["hero.title"])}`);
console.log(`   muestra ${sampleLoc} legal.terms.body: ${JSON.stringify((content[sampleLoc]?.["legal.terms.body"] || "").slice(0, 60))}`);
