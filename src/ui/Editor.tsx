"use client";
import { useState, useRef, useEffect } from "react";

export function Editor({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [copied, setCopied] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const onChange = (v: string) => {
    setText(v); setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await fetch(`/api/transcription/${id}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: v }) }).catch(() => {});
      setSaved(true);
    }, 800);
  };

  const dl = (fmt: string) => <a className="btn btn-ghost" href={`/api/transcription/${id}/export?format=${fmt}`} style={{ fontSize: 14, padding: "9px 16px" }}>{fmt.toUpperCase()}</a>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{saved ? "Guardado ✓" : "Guardando…"}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-ghost" style={{ fontSize: 14, padding: "9px 16px" }} onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "¡Copiado!" : "Copiar"}</button>
          <span className="muted" style={{ fontSize: 13 }}>Descargar:</span>
          {dl("txt")}{dl("srt")}{dl("docx")}{dl("pdf")}{dl("csv")}
        </div>
      </div>
      <textarea value={text} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 420, fontSize: 15, lineHeight: 1.7, resize: "vertical" }} />
    </div>
  );
}
