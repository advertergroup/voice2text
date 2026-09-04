"use client";
import { useEffect, useRef, useState } from "react";
import type { UIStrings } from "../lib/ui.ts";

const f = (str: string, vars: Record<string, string>) => Object.keys(vars).reduce((a, k) => a.replaceAll(`{${k}}`, vars[k]!), str);

type ExitOffer = { label: string; title: string; text: string; accept: string; decline: string } | null;

// Checkout propio embebido (Stripe Payment Element) con los colores de marca. Sin nav ni salidas + oferta de salida.
export function CheckoutForm(props: {
  clientSecret: string; pk: string; todayLabel: string; monthlyLabel: string; trialDays: number;
  transcriptionId: string; prefillEmail: string; s: UIStrings;
  textos: { subtitle: string; button: string; legal: string; secure: string };
  exitOffer: ExitOffer;
  brand?: string;
}) {
  const { clientSecret, pk, todayLabel, monthlyLabel, trialDays, transcriptionId, prefillEmail, s, textos, exitOffer, brand = "Voice To Text" } = props;
  const [email, setEmail] = useState(prefillEmail || "");
  const [today, setToday] = useState(todayLabel);      // precio de hoy (baja si acepta la oferta)
  const [showOffer, setShowOffer] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wallet, setWallet] = useState(false);         // ¿se ha dibujado Apple/Google Pay?
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const emailRef = useRef(prefillEmail || "");         // el confirm del monedero corre en un closure viejo
  const peMounted = useRef(false);
  const offerDone = useRef(false); // ya mostrada o aceptada → no repetir

  const vars = { today, price: monthlyLabel, n: String(trialDays) };
  const B = "#4f46e5";

  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      const S = (window as any).Stripe;
      if (!S || peMounted.current) return;
      const stripe = S(pk);
      stripeRef.current = stripe;
      const elements = stripe.elements({
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: B, colorText: "#0f172a", colorDanger: "#dc2626", borderRadius: "10px", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", spacingUnit: "4px" } },
      });
      elementsRef.current = elements;
      // Botón del monedero (Apple Pay / Google Pay), ARRIBA del formulario: en
      // SnapPassport Apple Pay aprueba el 77,5% frente al 47,3% de teclear la
      // tarjeta. MISMO objeto `elements` = MISMO PaymentIntent: imposible
      // cobrar dos veces. Apple Pay solo se dibuja con el dominio verificado
      // en Stripe (payment_method_domains); sin eso no hay error, no aparece.
      const ece = elements.create("expressCheckout", { emailRequired: true, paymentMethods: { link: "never" } });
      ece.mount("#express-checkout");
      ece.on("ready", (ev: any) => { if (!cancelled && ev?.availablePaymentMethods) setWallet(true); });
      ece.on("confirm", async (ev: any) => {
        // El email lo da la hoja del monedero (emailRequired); si no, el campo.
        const mail = ev?.billingDetails?.email || emailRef.current || "";
        const piId = clientSecret.split("_secret")[0];
        if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
          await fetch("/api/pay/prepare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentIntentId: piId, email: mail }) }).catch(() => {});
        }
        const returnUrl = `${window.location.origin}/pay/complete?t=${encodeURIComponent(transcriptionId)}`;
        const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl, receipt_email: mail || undefined } });
        if (error) setErr(error.message || s.pay_error!);
      });
      const pe = elements.create("payment", { layout: "tabs" });
      pe.mount("#payment-element");
      peMounted.current = true;
      if (!cancelled) setReady(true);
    };
    if ((window as any).Stripe) boot();
    else { const sc = document.createElement("script"); sc.src = "https://js.stripe.com/v3"; sc.async = true; sc.onload = boot; document.body.appendChild(sc); }
    return () => { cancelled = true; };
  }, [clientSecret, pk]);

  // Oferta de salida: al intentar abandonar (ratón por arriba en desktop, atrás en móvil) → una sola vez.
  useEffect(() => {
    if (!exitOffer) return;
    const trigger = () => {
      if (offerDone.current) return;
      offerDone.current = true; setShowOffer(true);
      // Analítica: oferta mostrada (beacon; nunca bloquea).
      try { fetch("/api/t", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: "offer_shown" }), keepalive: true }).catch(() => {}); } catch {}
    };
    const onMouseOut = (e: MouseEvent) => { if (e.clientY <= 0 && !e.relatedTarget) trigger(); };
    document.addEventListener("mouseout", onMouseOut);
    try { history.pushState(null, "", location.href); } catch {}
    const onPop = () => { if (!offerDone.current) { trigger(); try { history.pushState(null, "", location.href); } catch {} } };
    window.addEventListener("popstate", onPop);
    return () => { document.removeEventListener("mouseout", onMouseOut); window.removeEventListener("popstate", onPop); };
  }, [exitOffer]);

  const aceptarOferta = async () => {
    const piId = clientSecret.split("_secret")[0];
    try {
      const r = await fetch("/api/pay/offer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentIntentId: piId }) });
      const j = await r.json();
      if (j.ok && j.label) { try { await elementsRef.current?.fetchUpdates(); } catch {} setToday(j.label); }
    } catch { /* sigue al precio normal */ }
    setShowOffer(false);
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeRef.current || !elementsRef.current || busy) return;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr(s.email_invalid!); return; }
    setBusy(true); setErr("");
    const piId = clientSecret.split("_secret")[0];
    await fetch("/api/pay/prepare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentIntentId: piId, email }) }).catch(() => {});
    const returnUrl = `${window.location.origin}/pay/complete?t=${encodeURIComponent(transcriptionId)}`;
    const { error } = await stripeRef.current.confirmPayment({ elements: elementsRef.current, confirmParams: { return_url: returnUrl, receipt_email: email } });
    if (error) { setErr(error.message || s.pay_error!); setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f7f8fb,#ffffff)", padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 20, color: "#0f172a", marginBottom: 18 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>🎙️</span>
        {brand}
      </div>

      <div style={{ width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 12px 40px rgba(2,6,23,.08)", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{s.pay_today}</div>
          <div style={{ fontWeight: 800, fontSize: 30, color: B }}>{today}</div>
        </div>
        {textos.subtitle && <p style={{ color: "#475569", fontSize: 13.5, margin: "6px 0 0" }}>{f(textos.subtitle, vars)}</p>}
        <hr style={{ border: 0, borderTop: "1px solid #eef1f5", margin: "18px 0" }} />

        <div id="express-checkout" />
        {wallet && <hr style={{ border: 0, borderTop: "1px solid #eef1f5", margin: "16px 0" }} />}

        <form onSubmit={pay}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{s.email}</label>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); emailRef.current = e.target.value; }} placeholder="you@email.com" required
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 15, margin: "6px 0 16px", outline: "none" }} />
          <div id="payment-element" style={{ minHeight: 40 }} />
          {!ready && <div style={{ color: "#94a3b8", fontSize: 14, padding: "10px 0" }}>{s.loading_pay}</div>}
          {err && <div style={{ color: "#dc2626", fontSize: 14, marginTop: 12 }}>{err}</div>}
          <button type="submit" disabled={!ready || busy}
            style={{ width: "100%", marginTop: 18, padding: "15px 18px", border: 0, borderRadius: 12, background: busy ? "#94a3b8" : "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: busy ? "default" : "pointer", boxShadow: "0 10px 24px rgba(79,70,229,.28)" }}>
            {busy ? s.processing : f(textos.button || s.cta!, vars)}
          </button>
        </form>

        {textos.legal && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 14 }} dangerouslySetInnerHTML={{ __html: f(textos.legal, vars) }} />}
        {textos.secure && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 6 }}>🔒 {f(textos.secure, vars)}</p>}
      </div>

      {/* Oferta de salida */}
      {showOffer && exitOffer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(2,6,23,.35)", padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>🎁</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>{exitOffer.title}</h2>
            <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6 }}>{f(exitOffer.text, { oferta: exitOffer.label, normal: todayLabel, monthly: monthlyLabel, days: String(trialDays) })}</p>
            <button onClick={aceptarOferta}
              style={{ width: "100%", marginTop: 18, padding: "15px 18px", border: 0, borderRadius: 12, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 10px 24px rgba(79,70,229,.28)" }}>
              {f(exitOffer.accept, { oferta: exitOffer.label })}
            </button>
            <button onClick={() => setShowOffer(false)} style={{ marginTop: 14, background: "none", border: 0, color: "#94a3b8", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>
              {exitOffer.decline}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
