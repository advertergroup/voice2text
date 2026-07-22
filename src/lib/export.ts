import { Document, Packer, Paragraph, TextRun } from "docx";
import type { Segmento } from "./transcribe.ts";

/** TXT: el propio texto. */
export function toTxt(text: string): Buffer { return Buffer.from(text, "utf8"); }

/** SRT: subtítulos a partir de los segmentos con timestamps. */
export function toSrt(segments: Segmento[]): Buffer {
  const ts = (s: number) => {
    const ms = Math.floor((s % 1) * 1000);
    const tot = Math.floor(s);
    const hh = String(Math.floor(tot / 3600)).padStart(2, "0");
    const mm = String(Math.floor((tot % 3600) / 60)).padStart(2, "0");
    const ss = String(tot % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss},${String(ms).padStart(3, "0")}`;
  };
  const body = segments.map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.text.trim()}\n`).join("\n");
  return Buffer.from(body, "utf8");
}

/** DOCX vía la librería `docx`. */
export async function toDocx(title: string, text: string): Promise<Buffer> {
  const paras = [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }),
    new Paragraph({ text: "" }),
    ...text.split(/\n+/).map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 24 })] })),
  ];
  const doc = new Document({ sections: [{ children: paras }] });
  return Packer.toBuffer(doc);
}

/** PDF de texto multipágina (generador propio, sin dependencias pesadas). */
export function toPdf(title: string, text: string): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const wrap = (s: string, w: number) => {
    const out: string[] = [];
    for (const raw of s.split(/\n/)) {
      let line = "";
      for (const word of raw.split(/\s+/)) {
        if ((line + " " + word).trim().length > w) { out.push(line.trim()); line = word; }
        else line += " " + word;
      }
      out.push(line.trim());
    }
    return out;
  };
  const lines = [title, "", ...wrap(text, 92)];
  const perPage = 52, lineH = 14, top = 800, left = 56;
  const pagesLines: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pagesLines.push(lines.slice(i, i + perPage));
  if (!pagesLines.length) pagesLines.push([""]);

  const objs: string[] = [];
  const fontObj = 3;
  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];
  let nextId = 4;
  for (let i = 0; i < pagesLines.length; i++) { pageObjIds.push(nextId++); contentObjIds.push(nextId++); }

  // 1 catalog, 2 pages
  objs[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objs[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>\nendobj\n`;
  objs[fontObj] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  for (let i = 0; i < pagesLines.length; i++) {
    const pid = pageObjIds[i]!, cid = contentObjIds[i]!;
    objs[pid] = `${pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${cid} 0 R >>\nendobj\n`;
    let stream = `BT /F1 11 Tf ${left} ${top} Td ${lineH} TL\n`;
    pagesLines[i]!.forEach((ln, idx) => { stream += `${idx === 0 ? "" : "T* "}(${esc(ln)}) Tj\n`; });
    stream += `ET`;
    objs[cid] = `${cid} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`;
  }
  let pdf = `%PDF-1.4\n`;
  const offsets: number[] = [];
  const total = nextId; // ids 1..nextId-1
  for (let id = 1; id < total; id++) { offsets[id] = Buffer.byteLength(pdf); pdf += objs[id]; }
  const xrefPos = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let id = 1; id < total; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export const EXPORTS: Record<string, { mime: string; ext: string }> = {
  txt: { mime: "text/plain; charset=utf-8", ext: "txt" },
  srt: { mime: "application/x-subrip; charset=utf-8", ext: "srt" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  pdf: { mime: "application/pdf", ext: "pdf" },
};
