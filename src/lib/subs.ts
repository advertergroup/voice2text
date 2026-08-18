import type { Segmento } from "./transcribe.ts";

/** Parsea un SRT o VTT a { text, segments }. Para .txt devuelve el texto plano sin segmentos. */
export function parseTranscriptFile(nombre: string, contenido: string): { text: string; segments: Segmento[] } {
  const ext = (nombre.split(".").pop() || "").toLowerCase();
  if (ext === "srt" || ext === "vtt") return parseSubs(contenido);
  return { text: contenido.replace(/\r\n/g, "\n").trim(), segments: [] };
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
