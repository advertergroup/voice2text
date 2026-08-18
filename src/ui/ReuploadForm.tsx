"use client";
import { useRef, useState } from "react";
import type { UIStrings } from "../lib/ui.ts";

/** Subida del archivo COMPLETO tras pagar (para archivos grandes cuya preview fue parcial). */
export function ReuploadForm({ id, s }: { id: string; s: UIStrings }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(f: File) {
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.append("file", f, f.name);
    try {
      const r = await fetch(`/api/transcribe/full?id=${id}`, { method: "POST", body: fd });
      if (r.ok) { location.reload(); return; }
      setErr("No se pudo subir el archivo. Inténtalo de nuevo."); setBusy(false);
    } catch { setErr("No se pudo subir. Revisa tu conexión."); setBusy(false); }
  }

  return (
    <div className="card" style={{ textAlign: "center", padding: 36 }}>
      <div style={{ fontSize: 32 }}>📤</div>
      <h3 style={{ margin: "10px 0 4px" }}>{s.reupload_title}</h3>
      <p className="muted" style={{ maxWidth: 460, margin: "0 auto 18px" }}>{s.reupload_desc}</p>
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => !busy && inputRef.current?.click()}>
        {busy ? s.uploading : s.reupload_btn}
      </button>
      <input ref={inputRef} type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }} />
      {err && <div className="err" style={{ marginTop: 14 }}>{err}</div>}
    </div>
  );
}
