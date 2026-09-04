"use client";
import { useEffect, useRef, useState } from "react";
import type { QuotaModalTexts } from "./Uploader.tsx";

export interface MicTexts {
  tap: string; recording: string; stop: string; again: string; start: string; uploading: string; denied: string;
}

/** Grabador de voz (talk to text): micrófono → grabación → "iniciar transcripción" → pipeline normal. */
export function MicRecorder({ t, quotaLocked = false, quotaTexts, quotaCtaHref = "/pay", lang = "", bare = false }: {
  t: MicTexts; quotaLocked?: boolean; quotaTexts?: QuotaModalTexts; quotaCtaHref?: string; lang?: string;
  /** true = sin su propia tarjeta (va embebido dentro de otra, p. ej. la de subida). */
  bare?: boolean;
}) {
  const [fase, setFase] = useState<"idle" | "rec" | "done" | "up">("idle");
  const [seg, setSeg] = useState(0);
  const [err, setErr] = useState("");
  const [showQuota, setShowQuota] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<any>(null);
  const audioUrlRef = useRef<string>("");

  useEffect(() => () => { clearInterval(timerRef.current); if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, []);

  const gate = (): boolean => { if (quotaLocked) { setShowQuota(true); return true; } return false; };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  async function grabar() {
    if (gate()) return;
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : (MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "");
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        blobRef.current = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(blobRef.current);
        setFase("done");
      };
      mediaRef.current = rec;
      rec.start(1000);
      setSeg(0); setFase("rec");
      timerRef.current = setInterval(() => setSeg((x) => x + 1), 1000);
    } catch {
      setErr(t.denied);
    }
  }

  function parar() { clearInterval(timerRef.current); mediaRef.current?.stop(); }

  async function transcribir() {
    if (gate() || !blobRef.current || fase === "up") return;
    setFase("up"); setErr("");
    const esMp4 = (blobRef.current.type || "").includes("mp4");
    const fd = new FormData();
    fd.append("file", blobRef.current, esMp4 ? "recording.m4a" : "recording.webm");
    fd.append("source", "mic");
    if (lang) fd.append("language", lang); // el idioma de la página como pista (clips cortos confunden al auto-detect)
    try {
      // Sigue el redirect del servidor y navega a la URL final (en navegador real el Location es invisible).
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (r.redirected && r.url) { window.location.href = r.url; return; }
      if (r.ok && r.url) { window.location.href = r.url; return; }
      setErr("Upload failed. Please try again."); setFase("done");
    } catch { setErr("Upload failed. Check your connection."); setFase("done"); }
  }

  const B = { width: 96, height: 96, borderRadius: "50%", border: 0, cursor: "pointer", fontSize: 38, color: "#fff", boxShadow: "0 12px 30px rgba(79,70,229,.35)" } as const;

  return (
    <div className={bare ? undefined : "card"} style={{ maxWidth: 560, margin: "0 auto", padding: bare ? "0" : 34, textAlign: "center" }}>
      {fase === "idle" && (
        <>
          <button onClick={grabar} style={{ ...B, background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }} aria-label="record">🎙️</button>
          {/* La frase también arranca la grabación (mismo gesto que el botón), en todos los idiomas. */}
          <p onClick={grabar} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); grabar(); } }}
             style={{ fontWeight: 600, marginTop: 16, cursor: "pointer", userSelect: "none" }}>{t.tap}</p>
        </>
      )}
      {fase === "rec" && (
        <>
          <button onClick={parar} style={{ ...B, background: "linear-gradient(135deg,#dc2626,#b91c1c)", animation: "pulse 1.2s infinite" }} aria-label="stop">⏹️</button>
          <p style={{ fontWeight: 700, marginTop: 16, color: "#dc2626" }}>● {t.recording} {fmt(seg)}</p>
          <p className="muted" style={{ fontSize: 14 }}>{t.stop}</p>
          <style>{`@keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}`}</style>
        </>
      )}
      {(fase === "done" || fase === "up") && (
        <>
          <audio controls src={audioUrlRef.current} style={{ width: "100%", marginBottom: 18 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-ghost" disabled={fase === "up"} onClick={() => { setFase("idle"); setSeg(0); }}>{t.again}</button>
            <button className="btn btn-primary btn-lg" disabled={fase === "up"} onClick={transcribir}>
              {fase === "up" ? t.uploading : t.start}
            </button>
          </div>
        </>
      )}
      {err && <div className="err" style={{ marginTop: 16 }}>{err}</div>}

      {showQuota && quotaTexts && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowQuota(false)}>
          <div style={{ maxWidth: 430, width: "100%", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(2,6,23,.35)", padding: 30, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36 }}>🚀</div>
            <h2 style={{ margin: "12px 0 8px", fontSize: 21, lineHeight: 1.3 }}>{quotaTexts.title}</h2>
            <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6 }}>{quotaTexts.desc}</p>
            <a href={quotaCtaHref} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 16, display: "block" }}>{quotaTexts.cta}</a>
            <button onClick={() => setShowQuota(false)} style={{ marginTop: 14, background: "none", border: 0, color: "#94a3b8", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>{quotaTexts.later}</button>
          </div>
        </div>
      )}
    </div>
  );
}
