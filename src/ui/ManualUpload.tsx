"use client";
import { useRef, useState } from "react";

/** Botón de subida (admin) para completar una transcripción manual. */
export function ManualUpload({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const subir = async (f: File) => {
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.append("file", f, f.name);
    try {
      const r = await fetch(`/api/admin/manual?id=${id}`, { method: "POST", body: fd });
      if (r.ok) { window.location.href = "/admin/manual?done=1"; return; }
      const j = await r.json().catch(() => ({}));
      setErr(j.error || "Error al subir"); setBusy(false);
    } catch { setErr("Error de red"); setBusy(false); }
  };

  return (
    <div style={{ textAlign: "right" }}>
      <button className="btn btn-primary" disabled={busy} onClick={() => !busy && inputRef.current?.click()}>
        {busy ? "Subiendo…" : "📤 Subir archivo"}
      </button>
      <input ref={inputRef} type="file" accept="audio/*,video/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }} />
      {err && <div className="err" style={{ marginTop: 8, fontSize: 13 }}>{err}</div>}
    </div>
  );
}
