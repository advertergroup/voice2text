// Genera src/lib/translations.legal.ts desde la salida del workflow de traducción legal.
// Decodifica entidades HTML (&amp; &lt; &gt; &#39; …) que introdujo la salida estructurada.
import fs from "node:fs";
import path from "node:path";

const OUT_FILE = process.argv[2];
if (!OUT_FILE) { console.error("uso: node gen_legal.mjs <workflow-output.json>"); process.exit(1); }

const raw = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
const result = raw.result || raw;

function dec(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

const out = {};
for (const loc of Object.keys(result)) {
  const d = result[loc] || {};
  out[loc] = {};
  for (const k of Object.keys(d)) out[loc][k] = dec(d[k]);
}

const banner = `// AUTOGENERADO por scripts/gen_legal.mjs — NO editar a mano.\n// Traducciones de los textos legales (términos, privacidad, reembolsos, soporte, pie) para idiomas != es.\n// Placeholders {brand} {company} {address} {email} se resuelven en loadContent().\n`;
const body = banner + `\nexport const LEGAL_TRANSLATIONS: Record<string, Record<string, string>> = ${JSON.stringify(out, null, 2)};\n`;

const dest = path.join(process.cwd(), "src", "lib", "translations.legal.ts");
fs.writeFileSync(dest, body, "utf8");
const locs = Object.keys(out);
console.log("✅ Generado", dest);
console.log("   idiomas:", locs.join(", "));
console.log("   claves/idioma:", Object.keys(out[locs[0]] || {}).length);
console.log("   muestra fr terms (60):", JSON.stringify((out.fr?.["legal.terms.body"] || "").slice(0, 60)));
console.log("   ¿placeholders intactos en de?:", /\{company\}/.test(out.de?.["legal.terms.body"] || ""), /\{email\}/.test(out.de?.["legal.refund.body"] || ""));
console.log("   ¿href intacto en it?:", /href='\/refund'/.test(out.it?.["legal.terms.body"] || ""));
