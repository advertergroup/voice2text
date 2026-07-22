"use client";
import { useState, useRef } from "react";

const IDIOMAS = [["auto", "Detectar automáticamente"], ["es", "Español"], ["en", "Inglés"], ["fr", "Francés"], ["de", "Alemán"], ["it", "Italiano"], ["pt", "Portugués"]];

export function Uploader({ dropzoneText, selectText }: { dropzoneText: string; selectText: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action="/api/transcribe" method="post" encType="multipart/form-data" onSubmit={() => setBusy(true)}>
      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && inputRef.current) { const dt = new DataTransfer(); dt.items.add(f); inputRef.current.files = dt.files; setFile(f); } }}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: "pointer" }}
      >
        <div className="ico">{file ? "🎧" : "📤"}</div>
        <div style={{ fontWeight: 600, marginTop: 8 }}>{file ? file.name : dropzoneText}</div>
        {file && <div className="muted" style={{ fontSize: 13 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>}
        <div style={{ marginTop: 14 }}><span className="btn btn-primary">{selectText}</span></div>
        <input ref={inputRef} name="file" type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <div style={{ textAlign: "center", margin: "14px 0", color: "var(--muted)" }}>— o pega una URL (YouTube, etc.) —</div>
      <input name="url" type="url" placeholder="https://..." style={{ maxWidth: 520, margin: "0 auto", display: "block" }} />

      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
        <label style={{ fontSize: 14 }}>Idioma
          <select name="language" defaultValue="auto" style={{ marginTop: 4 }}>{IDIOMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label style={{ fontSize: 14 }}>Modo
          <select name="mode" defaultValue="STANDARD" style={{ marginTop: 4 }}>
            <option value="FAST">⚡ Rápido</option>
            <option value="STANDARD">⚙️ Estándar</option>
            <option value="PRO">🧠 Pro</option>
          </select>
        </label>
      </div>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Procesando…" : "Transcribir"}</button>
      </div>
    </form>
  );
}
