"use client";
import { useState, useRef } from "react";
import type { UIStrings } from "../lib/ui.ts";

// Archivos hasta este tamaño se suben enteros; los mayores se trocean (solo el inicio) para la preview.
const FULL_MAX_BYTES = 200 * 1024 * 1024;   // 200 MB
const PREVIEW_CHUNK_BYTES = 20 * 1024 * 1024; // 20 MB (suficiente para la preview del inicio)

export interface QuotaModalTexts { title: string; desc: string; cta: string; later: string }

// Fallback EN por si un caller viejo no pasa `s` (los callers actuales lo pasan siempre).
const DEF: Record<string, string> = {
  up_drag: "or drag & drop your file here", up_url_link: "You can also paste a URL",
  up_url_ph: "Paste your link here (YouTube, etc.)", up_transcribe: "Transcribe", up_uploading: "Uploading…",
  up_err: "Upload failed. Check your connection and try again.",
  up_legal_pre: "By uploading a file or URL you agree to our", legal_terms: "Terms", legal_privacy: "Privacy",
  up_fast_hint: "Fast AI transcription", up_langs_hint: "90+ languages",
  up_url_hint: "Paste a URL", up_mic_hint: "Record with your microphone",
};

/**
 * Tarjeta ÚNICA de subida (estilo moderno): botón grande, arrastrar y soltar,
 * URL desplegable y micro — todo dentro del mismo cuadro, con fila de iconos
 * abajo y la línea legal debajo. La lógica de subida no cambia.
 */
export function Uploader({ dropzoneText: _dz, selectText, quotaLocked = false, quotaTexts, quotaCtaHref = "/pay", s, micHref = "/talk-to-text", termsHref: _terms = "/terms", privacyHref: _priv = "/privacy" }: {
  dropzoneText: string; selectText: string; quotaLocked?: boolean; quotaTexts?: QuotaModalTexts; quotaCtaHref?: string;
  s?: UIStrings; micHref?: string; termsHref?: string; privacyHref?: string;
}) {
  const tx = (k: string) => (s && s[k]) || DEF[k] || k;
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [err, setErr] = useState("");
  const [showQuota, setShowQuota] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  // Cuota agotada → cualquier intento de transcribir abre el aviso del plan.
  const gate = (): boolean => { if (quotaLocked) { setShowQuota(true); return true; } return false; };

  async function enviar(f: File | null) {
    if (busy || gate()) return;
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
      // Sigue el redirect del servidor y navega a la URL final (en navegador real el Location es invisible).
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (r.redirected && r.url) { window.location.href = r.url; return; }
      if (r.ok && r.url) { window.location.href = r.url; return; }
      setErr(tx("up_err")); setBusy(false);
    } catch {
      setErr(tx("up_err")); setBusy(false);
    }
  }

  const abrirPicker = () => { if (gate() || busy) return; inputRef.current?.click(); };
  const toggleUrl = () => { if (gate() || busy) return; setUrlOpen((v) => { const n = !v; if (n) setTimeout(() => urlRef.current?.focus(), 50); return n; }); };

  const SVG = (p: { d: React.ReactNode }) => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p.d}</svg>
  );

  return (
    <div>
      <div
        className={"upcard" + (drag ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (gate()) return; const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); enviar(f); } }}
      >
        <div className="upcard-main" onClick={abrirPicker} style={{ cursor: busy ? "default" : "pointer" }}>
          {busy ? (
            <>
              <div className="spinner" />
              <div style={{ fontWeight: 600, marginTop: 14 }}>{tx("up_uploading")}</div>
              {file && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</div>}
            </>
          ) : (
            <>
              <span className="btn btn-primary btn-pill up-select">{selectText}</span>
              <div className="up-drag">{tx("up_drag")}</div>
              <button type="button" className="up-url-link" onClick={(e) => { e.stopPropagation(); toggleUrl(); }}>{tx("up_url_link")}</button>
            </>
          )}
          <input ref={inputRef} type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) enviar(f); }} />
        </div>

        <div className="up-url-row" style={{ display: urlOpen && !busy ? "flex" : "none" }} onClick={(e) => e.stopPropagation()}>
          <input ref={urlRef} type="url" placeholder={tx("up_url_ph")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enviar(null); } }} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => enviar(null)} style={{ whiteSpace: "nowrap" }}>{tx("up_transcribe")}</button>
        </div>

        <div className="upcard-foot" onClick={(e) => e.stopPropagation()} style={{ justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="up-ico" title={tx("up_url_hint")} onClick={toggleUrl}>
              <SVG d={<><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 18.5" /></>} />
            </button>
            <a className="up-ico" title={tx("up_mic_hint")} href={micHref}>
              <SVG d={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>} />
            </a>
          </div>
        </div>
      </div>

      {err && <div className="err" style={{ maxWidth: 560, margin: "12px auto 0" }}>{err}</div>}

      {/* Aviso de cuota: la prueba incluye una transcripción → activar el plan */}
      {showQuota && quotaTexts && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
             onClick={() => setShowQuota(false)}>
          <div style={{ maxWidth: 430, width: "100%", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(2,6,23,.35)", padding: 30, textAlign: "center" }}
               onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36 }}>🚀</div>
            <h2 style={{ margin: "12px 0 8px", fontSize: 21, lineHeight: 1.3 }}>{quotaTexts.title}</h2>
            <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6 }}>{quotaTexts.desc}</p>
            <a href={quotaCtaHref} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 16, display: "block" }}>{quotaTexts.cta}</a>
            <button onClick={() => setShowQuota(false)} style={{ marginTop: 14, background: "none", border: 0, color: "#94a3b8", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>
              {quotaTexts.later}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
