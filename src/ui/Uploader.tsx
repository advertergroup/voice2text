"use client";
import { useState, useRef } from "react";

export function Uploader({ dropzoneText, selectText }: { dropzoneText: string; selectText: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Envía en cuanto hay archivo (sin que el usuario tenga que elegir nada más).
  const submitNow = () => { setBusy(true); inputRef.current?.form?.requestSubmit(); };
  const onPick = (f: File | null) => { setFile(f); if (f) setTimeout(submitNow, 50); };

  return (
    <form action="/api/transcribe" method="post" encType="multipart/form-data" onSubmit={() => setBusy(true)}>
      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && inputRef.current) { const dt = new DataTransfer(); dt.items.add(f); inputRef.current.files = dt.files; onPick(f); } }}
        onClick={() => !busy && inputRef.current?.click()}
        style={{ cursor: busy ? "default" : "pointer" }}
      >
        <div className="ico">{busy ? "⏳" : file ? "🎧" : "📤"}</div>
        <div style={{ fontWeight: 600, marginTop: 8 }}>{busy ? "Subiendo…" : file ? file.name : dropzoneText}</div>
        {file && !busy && <div className="muted" style={{ fontSize: 13 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>}
        {!busy && <div style={{ marginTop: 14 }}><span className="btn btn-primary">{selectText}</span></div>}
        <input ref={inputRef} name="file" type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </div>

      <div style={{ textAlign: "center", margin: "14px 0", color: "var(--muted)" }}>— o pega una URL (YouTube, etc.) —</div>
      <div style={{ display: "flex", gap: 10, maxWidth: 560, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
        <input name="url" type="url" placeholder="https://..." style={{ flex: 1, minWidth: 240 }} />
        <button className="btn btn-primary" disabled={busy} style={{ whiteSpace: "nowrap" }}>{busy ? "Procesando…" : "Transcribir"}</button>
      </div>
    </form>
  );
}
