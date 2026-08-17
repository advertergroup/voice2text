"use client";
import { useEffect, useRef, useState } from "react";

// Checkout propio embebido (Stripe Payment Element) con los colores de marca. Sin nav ni salidas.
export function CheckoutForm(props: {
  clientSecret: string; pk: string; todayLabel: string; monthlyLabel: string; trialDays: number;
  transcriptionId: string; prefillEmail: string; titulo: string;
}) {
  const { clientSecret, pk, todayLabel, monthlyLabel, trialDays, transcriptionId, prefillEmail } = props;
  const [email, setEmail] = useState(prefillEmail || "");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const peMounted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      const S = (window as any).Stripe;
      if (!S || peMounted.current) return;
      const stripe = S(pk);
      stripeRef.current = stripe;
      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#4f46e5", colorText: "#0f172a", colorDanger: "#dc2626", borderRadius: "10px", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", spacingUnit: "4px" },
        },
      });
      elementsRef.current = elements;
      const pe = elements.create("payment", { layout: "tabs" });
      pe.mount("#payment-element");
      peMounted.current = true;
      if (!cancelled) setReady(true);
    };
    if ((window as any).Stripe) { boot(); return; }
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3"; s.async = true; s.onload = boot;
    document.body.appendChild(s);
    return () => { cancelled = true; };
  }, [clientSecret, pk]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeRef.current || !elementsRef.current || busy) return;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr("Introduce un email válido."); return; }
    setBusy(true); setErr("");
    // Asocia el email/cliente al pago para crear la cuenta y la suscripción tras cobrar.
    const piId = clientSecret.split("_secret")[0];
    await fetch("/api/pay/prepare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentIntentId: piId, email }) }).catch(() => {});
    const returnUrl = `${window.location.origin}/pay/complete?t=${encodeURIComponent(transcriptionId)}`;
    const { error } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: returnUrl, receipt_email: email },
    });
    if (error) { setErr(error.message || "No se pudo procesar el pago."); setBusy(false); }
  };

  const B = "#4f46e5";
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f7f8fb,#ffffff)", padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 20, color: "#0f172a", marginBottom: 18 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>🎙️</span>
        Voice2Text
      </div>

      <div style={{ width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 12px 40px rgba(2,6,23,.08)", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>A pagar hoy</div>
          <div style={{ fontWeight: 800, fontSize: 30, color: B }}>{todayLabel}</div>
        </div>
        <p style={{ color: "#475569", fontSize: 13.5, margin: "6px 0 0" }}>
          {trialDays} días de acceso completo. Después <b>{monthlyLabel}/mes</b>. Cancela cuando quieras.
        </p>
        <hr style={{ border: 0, borderTop: "1px solid #eef1f5", margin: "18px 0" }} />

        <form onSubmit={pay}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 15, margin: "6px 0 16px", outline: "none" }} />

          <div id="payment-element" style={{ minHeight: 40 }} />
          {!ready && <div style={{ color: "#94a3b8", fontSize: 14, padding: "10px 0" }}>Cargando pago seguro…</div>}
          {err && <div style={{ color: "#dc2626", fontSize: 14, marginTop: 12 }}>{err}</div>}

          <button type="submit" disabled={!ready || busy}
            style={{ width: "100%", marginTop: 18, padding: "15px 18px", border: 0, borderRadius: 12, background: busy ? "#94a3b8" : "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: busy ? "default" : "pointer", boxShadow: "0 10px 24px rgba(79,70,229,.28)" }}>
            {busy ? "Procesando…" : `Desbloquear ahora — ${todayLabel}`}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 14 }}>
          Al continuar aceptas nuestros <a href="/terms" target="_blank" style={{ color: "#64748b" }}>Términos</a>, la <a href="/refund" target="_blank" style={{ color: "#64748b" }}>Suscripción y reembolsos</a> y la <a href="/privacy" target="_blank" style={{ color: "#64748b" }}>Privacidad</a>.
        </p>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 6 }}>🔒 Pago seguro con Stripe.</p>
      </div>
    </div>
  );
}
