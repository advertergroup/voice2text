"use client";
import { useState } from "react";
import type { UIStrings } from "../lib/ui.ts";

/** Vista "tu transcripción estará lista en <24h" + captura de email opcional para avisar. */
export function ManualNotice({ id, s, hasEmail }: { id: string; s: UIStrings; hasEmail: boolean }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    setBusy(true);
    try {
      await fetch(`/api/transcription/${id}/notify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      setDone(true);
    } catch { /* silencioso */ }
    setBusy(false);
  };

  return (
    <div className="card" style={{ textAlign: "center", padding: 44 }}>
      <div style={{ fontSize: 40 }}>🕐</div>
      <h3 style={{ margin: "12px 0 6px", fontSize: 21 }}>{s.manual_title}</h3>
      <p className="muted" style={{ maxWidth: 460, margin: "0 auto" }}>{s.manual_desc}</p>
      {!hasEmail && !done && (
        <form onSubmit={guardar} style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 22 }}>
          <input type="email" required placeholder={s.manual_email_q} value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ minWidth: 260, maxWidth: 320 }} />
          <button className="btn btn-primary" disabled={busy}>{s.manual_email_btn}</button>
        </form>
      )}
      {done && <p style={{ color: "var(--good)", fontWeight: 600, marginTop: 18 }}>✓ {s.manual_email_ok}</p>}
    </div>
  );
}
