"use client";
import { useState, useRef } from "react";

// Archivos hasta este tamaño se suben enteros; los mayores se trocean (solo el inicio) para la preview.
const FULL_MAX_BYTES = 200 * 1024 * 1024;   // 200 MB
const PREVIEW_CHUNK_BYTES = 20 * 1024 * 1024; // 20 MB (suficiente para la preview del inicio)

export function Uploader({ dropzoneText, selectText }: { dropzoneText: string; selectText: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  async function enviar(f: File | null) {
    if (busy) return;
    const url = urlRef.current?.value?.trim() || "";
    if (!f && !url) { setErr(""); return; }
    setBusy(true); setErr("");
    const fd = new FormData();
    if (f) {
      const partial = f.size > FULL_MAX_BYTES;
      const blob = partial ? f.slice(0, PREVIEW_CHUNK_BYTES) : f;
      fd.append("file", blob, f.name);      // solo el inicio si es grande → sin 413, preview siempre
      fd.append("partial", partial ? "1" : "0");
      fd.append("fullsize", String(f.size));
    } else {
      fd.append("url", url);
    }
    try {
      const r = await fetch("/api/transcribe", { method: "POST", body: fd, redirect: "manual" });
      const loc = r.headers.get("location") || (r.type === "opaqueredirect" ? "" : "");
      if (loc) { window.location.href = loc; return; }
      // Si el navegador no expone Location (opaqueredirect), recarga a la home; la ruta ya creó la transcripción.
      if (r.type === "opaqueredirect" || r.status === 0) { window.location.reload(); return; }
      setErr("No se pudo subir. Inténtalo de nuevo."); setBusy(false);
    } catch {
      setErr("No se pudo subir. Revisa tu conexión e inténtalo de nuevo."); setBusy(false);
    }
  }

  const onPick = (f: File | null) => { setFile(f); if (f) enviar(f); };

  return (
    <div>
      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); enviar(f); } }}
        onClick={() => !busy && inputRef.current?.click()}
        style={{ cursor: busy ? "default" : "pointer" }}
      >
        <div className="ico">{busy ? "⏳" : file ? "🎧" : "📤"}</div>
        <div style={{ fontWeight: 600, marginTop: 8 }}>{busy ? "Subiendo…" : file ? file.name : dropzoneText}</div>
        {file && !busy && <div className="muted" style={{ fontSize: 13 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>}
        {!busy && <div style={{ marginTop: 14 }}><span className="btn btn-primary">{selectText}</span></div>}
        <input ref={inputRef} type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </div>

      {err && <div className="err" style={{ maxWidth: 560, margin: "12px auto 0" }}>{err}</div>}

      <div style={{ textAlign: "center", margin: "14px 0", color: "var(--muted)" }}>— o pega una URL (YouTube, etc.) —</div>
      <div style={{ display: "flex", gap: 10, maxWidth: 560, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
        <input ref={urlRef} type="url" placeholder="https://..." style={{ flex: 1, minWidth: 240 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enviar(null); } }} />
        <button className="btn btn-primary" disabled={busy} onClick={() => enviar(null)} style={{ whiteSpace: "nowrap" }}>{busy ? "Procesando…" : "Transcribir"}</button>
      </div>
    </div>
  );
}
