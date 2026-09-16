// Regenera src/lib/ui.generated.ts fusionando lo ya generado con scripts/ui-translations/<locale>.json
// (traducciones añadidas a mano). Uso: node --experimental-strip-types scripts/merge_ui.mjs
import fs from "node:fs";
import path from "node:path";
const { UI_TRANSLATIONS } = await import("../src/lib/ui.generated.ts");
const dir = path.join(process.cwd(), "scripts", "ui-translations");
const out = JSON.parse(JSON.stringify(UI_TRANSLATIONS));
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const loc = f.replace(/\.json$/, "");
  const extra = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  out[loc] = { ...(out[loc] || {}), ...extra };
  console.log(loc, "+", Object.keys(extra).length, "→", Object.keys(out[loc]).length, "claves");
}
const body = `// AUTOGENERADO por scripts/gen_ui.mjs + scripts/merge_ui.mjs — NO editar a mano (añade JSON en scripts/ui-translations/).\nexport const UI_TRANSLATIONS: Record<string, Record<string, string>> = ${JSON.stringify(out, null, 2)};\n`;
fs.writeFileSync(path.join(process.cwd(), "src", "lib", "ui.generated.ts"), body, "utf8");
console.log("✅ ui.generated.ts regenerado");
