import fs from "node:fs";
import path from "node:path";
const OUT = process.argv[2];
const raw = JSON.parse(fs.readFileSync(OUT, "utf8"));
const result = raw.result || raw;
const dec = (s) => typeof s !== "string" ? s : s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&");
const out = {};
for (const loc of Object.keys(result)) { out[loc] = {}; for (const k of Object.keys(result[loc] || {})) out[loc][k] = dec(result[loc][k]); }
const body = `// AUTOGENERADO por scripts/gen_ui.mjs — NO editar a mano.\nexport const UI_TRANSLATIONS: Record<string, Record<string, string>> = ${JSON.stringify(out, null, 2)};\n`;
fs.writeFileSync(path.join(process.cwd(), "src", "lib", "ui.generated.ts"), body, "utf8");
console.log("✅ ui.generated.ts:", Object.keys(out).join(", "), "| claves fr:", Object.keys(out.fr || {}).length);
console.log("   de legal_sub:", JSON.stringify(out.de?.legal_sub));
