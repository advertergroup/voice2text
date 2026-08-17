"use client";
import { useState, useEffect, useRef } from "react";

/** Barra de progreso mientras se transcribe. Sondea el estado y recarga la página al terminar. */
export function ProgressBar({ id }: { id: string }) {
  const [p, setP] = useState(6);
  const done = useRef(false);

  useEffect(() => {
    // Animación suave hacia ~94%.
    const anim = setInterval(() => setP((x) => (x < 94 ? x + Math.max(0.4, (94 - x) * 0.05) : x)), 350);
    // Sondeo del estado real.
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/transcription/${id}/status`, { cache: "no-store" });
        const j = await r.json();
        if (j.status && j.status !== "PROCESSING" && j.status !== "QUEUED" && !done.current) {
          done.current = true; setP(100);
          setTimeout(() => location.reload(), 400);
        }
      } catch { /* reintenta */ }
    }, 2000);
    return () => { clearInterval(anim); clearInterval(poll); };
  }, [id]);

  return (
    <div className="card" style={{ textAlign: "center", padding: 46 }}>
      <div style={{ fontSize: 30, marginBottom: 12 }}>✍️</div>
      <div style={{ fontWeight: 700, fontSize: 19 }}>Preparando tu transcripción…</div>
      <p className="muted" style={{ marginTop: 4, marginBottom: 20 }}>Estamos procesando tu audio para que sea preciso.</p>
      <div style={{ height: 12, background: "var(--border)", borderRadius: 99, overflow: "hidden", maxWidth: 440, margin: "0 auto" }}>
        <div style={{ width: p + "%", height: "100%", background: "var(--accent)", borderRadius: 99, transition: "width .35s ease" }} />
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{Math.round(p)}%</div>
    </div>
  );
}
