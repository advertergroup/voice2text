/**
 * Candados contra la mezcla de idiomas:
 *  1) el diccionario de UI tiene TODAS las claves en TODOS los idiomas (si falta una, se rellenaba en inglés sin avisar);
 *  2) ninguna página pública lleva texto escrito a mano en el JSX (todo pasa por el contenido editable o el diccionario).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ui, UI_ES, UI_EN } from "../src/lib/ui.ts";
import { UI_TRANSLATIONS } from "../src/lib/ui.generated.ts";
import { LOCALE_CODES } from "../src/lib/locale.ts";

test("UI: mismas claves en ES y EN", () => {
  const es = Object.keys(UI_ES).sort(), en = Object.keys(UI_EN).sort();
  assert.deepEqual(es.filter((k) => !en.includes(k)), [], "claves solo en ES");
  assert.deepEqual(en.filter((k) => !es.includes(k)), [], "claves solo en EN");
});

test("UI: cada idioma tiene todas las claves (nada cae al inglés en silencio)", () => {
  const keys = Object.keys(UI_EN);
  for (const loc of LOCALE_CODES) {
    if (loc === "es" || loc === "en") continue;
    const tr = UI_TRANSLATIONS[loc] || {};
    const faltan = keys.filter((k) => !tr[k]);
    assert.deepEqual(faltan, [], `faltan en ${loc}`);
    // Y ninguna clave traducida se ha quedado igual que el inglés (salvo palabras universales).
    const universales = new Set(["email", "acct_email", "acct_name", "acct_trans", "sec_edit", "sec_export", "it_move", "st_err", "th_mode", "th_status", "th_date", "per_month", "legal_privacy"]);
    const iguales = keys.filter((k) => !universales.has(k) && tr[k] === UI_EN[k] && (UI_EN[k] || "").length > 3);
    assert.deepEqual(iguales, [], `sin traducir en ${loc}`);
  }
  // Placeholders: los mismos en cada idioma que en inglés.
  const ph = (s: string) => (s.match(/\{[a-z_]+\}/g) || []).sort().join(",");
  for (const loc of LOCALE_CODES) {
    const d = ui(loc);
    for (const k of keys) assert.equal(ph(d[k] || ""), ph(UI_EN[k] || ""), `placeholders de ${k} en ${loc}`);
  }
});

/** Texto JSX literal con letras (fuera de {…}), p. ej. `<p>Sube tu archivo</p>` o `>Abrir →<`. */
const RE_LITERAL = />\s*[^<>{}\n]*[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}[^<>{}\n]*</g;
const PUBLIC_DIRS = ["app", "src/ui"];
const EXCLUDE = [/[\\/]admin[\\/]/, /[\\/]api[\\/]/, /\.test\.ts$/, /AdminTabs/, /Heatmap/];
// Fragmentos permitidos: nombres de formato, marcas, símbolos y etiquetas técnicas.
const ALLOW = /^(TXT|PDF|DOCX|SRT|MP3|WAV|M4A|MP4|URL|YouTube|TikTok|Stripe|OK|FAQ|ID|AI|IA|Voice To Text|[0-9\s.,:%€$·—–-]+)$/;

function walk(dir: string, out: string[] = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

test("páginas públicas: sin texto escrito a mano en el JSX", () => {
  const hallazgos: string[] = [];
  for (const d of PUBLIC_DIRS) {
    for (const f of walk(d)) {
      if (EXCLUDE.some((re) => re.test(f))) continue;
      const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
      for (const m of src.matchAll(RE_LITERAL)) {
        const txt = m[0].slice(1, -1).trim();
        if (!txt || ALLOW.test(txt)) continue;
        if (/^<\/?[a-z]/.test(txt)) continue; // etiqueta HTML dentro de string
        if (/&&|\|\||=>|\?\s|^:/.test(txt)) continue; // expresión JSX, no texto
        hallazgos.push(`${f}: «${txt.slice(0, 60)}»`);
      }
    }
  }
  assert.deepEqual(hallazgos, [], "texto literal en componentes públicos");
});
