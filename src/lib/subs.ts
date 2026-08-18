import type { Segmento } from "./transcribe.ts";

/** Parsea un SRT/VTT/CSV a { text, segments }. Para .txt devuelve el texto plano sin segmentos. */
export function parseTranscriptFile(nombre: string, contenido: string): { text: string; segments: Segmento[] } {
  const ext = (nombre.split(".").pop() || "").toLowerCase();
  if (ext === "srt" || ext === "vtt") return parseSubs(contenido);
  if (ext === "csv") return parseCsvTranscript(contenido);
  return { text: contenido.replace(/\r\n/g, "\n").trim(), segments: [] };
}

/** Divide una línea CSV respetando comillas dobles. Detecta coma o punto y coma. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** "1:23", "01:02:03", "0:01.5" → segundos; null si no es un tiempo. */
function parseTiempo(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d{1,3}))?$/.exec(s.trim());
  if (!m) return null;
  const frac = m[4] ? Number("0." + m[4]) : 0;
  if (m[3] !== undefined) return (+m[1]!) * 3600 + (+m[2]!) * 60 + (+m[3]!) + frac;
  return (+m[1]!) * 60 + (+m[2]!) + frac;
}

/**
 * CSV de transcripción (p. ej. exports de otras herramientas: "Time,Script,...").
 * Detecta la columna de tiempo y la de texto por cabecera o por contenido; `end` = start de la fila siguiente.
 */
export function parseCsvTranscript(raw: string): { text: string; segments: Segmento[] } {
  const limpio = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lineas = limpio.split("\n").filter((l) => l.trim() !== "");
  if (lineas.length === 0) return { text: "", segments: [] };
  const sep = (lineas[0]!.match(/;/g)?.length || 0) > (lineas[0]!.match(/,/g)?.length || 0) ? ";" : ",";

  const filas = lineas.map((l) => splitCsvLine(l, sep));
  // ¿Cabecera? → mapea columnas por nombre; si no, detecta por contenido en la primera fila de datos.
  const head = filas[0]!.map((h) => h.toLowerCase());
  let timeIdx = head.findIndex((h) => /^(time|start|inicio|tiempo|timestamp)\b/.test(h));
  let textIdx = head.findIndex((h) => /(script|text|transcript|texto|caption|subtitle)/.test(h) && !/beautify|summary|topic/.test(h));
  let datos = filas;
  if (timeIdx >= 0 || textIdx >= 0) datos = filas.slice(1);
  const primera = datos[0] || [];
  if (timeIdx < 0) timeIdx = primera.findIndex((c) => parseTiempo(c) !== null);
  if (textIdx < 0) textIdx = primera.findIndex((c, i) => i !== timeIdx && c.length > 0 && parseTiempo(c) === null);

  // Sin columna de texto reconocible → trata todo como texto plano.
  if (textIdx < 0) return { text: lineas.join("\n"), segments: [] };

  const segments: Segmento[] = [];
  for (const f of datos) {
    const text = (f[textIdx] || "").trim();
    if (!text) continue;
    const start = timeIdx >= 0 ? parseTiempo(f[timeIdx] || "") : null;
    segments.push({ start: start ?? (segments.length ? segments[segments.length - 1]!.end : 0), end: 0, text });
  }
  // end = start del siguiente (último: +5s)
  for (let i = 0; i < segments.length; i++) {
    segments[i]!.end = i + 1 < segments.length ? segments[i + 1]!.start : segments[i]!.start + 5;
  }
  const conTiempos = timeIdx >= 0 && segments.length > 0;
  return { text: segments.map((s) => s.text).join(" ").trim(), segments: conTiempos ? segments : [] };
}

const TIME = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})|(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function toSec(s: string): number {
  const m = TIME.exec(s);
  if (!m) return 0;
  if (m[1] !== undefined) return (+m[1]!) * 3600 + (+m[2]!) * 60 + (+m[3]!) + (+m[4]!) / 1000;
  return (+m[5]!) * 60 + (+m[6]!) + (+m[7]!) / 1000;
}

function parseSubs(raw: string): { text: string; segments: Segmento[] } {
  const lineas = raw.replace(/\r\n/g, "\n").split("\n");
  const segments: Segmento[] = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i]!.trim();
    if (l.includes("-->")) {
      const [a, b] = l.split("-->");
      const start = toSec(a!.trim());
      const end = toSec((b || "").trim().split(" ")[0] || "");
      const buf: string[] = [];
      i++;
      while (i < lineas.length && lineas[i]!.trim() !== "") {
        // limpia etiquetas de estilo VTT (<c>, <i>, etc.)
        const t = lineas[i]!.replace(/<[^>]+>/g, "").trim();
        if (t) buf.push(t);
        i++;
      }
      const text = buf.join(" ").trim();
      if (text) segments.push({ start, end, text });
    }
    i++;
  }
  // dedup consecutivos idénticos (típico de los auto-subs de YouTube)
  const dedup = segments.filter((s, idx) => idx === 0 || s.text !== segments[idx - 1]!.text);
  return { text: dedup.map((s) => s.text).join(" ").trim(), segments: dedup };
}
