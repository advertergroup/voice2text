"use client";
import { useEffect } from "react";

/**
 * Tracking de comportamiento para el mapa de calor del admin (/admin/heatmap):
 *  - "click": posición (x % del ancho de ventana, y % del alto del documento) + elemento clicado.
 *  - "engagement": al salir de la página, scroll máximo alcanzado (%) y segundos en página.
 * Anónimo (cookie v2t_vid del middleware), sin datos personales, nunca bloquea la página.
 */
export function Comportamiento() {
  useEffect(() => {
    if (/^\/(admin|dashboard|login)/.test(location.pathname)) return;
    if (/(^|; )v2t_int=/.test(document.cookie)) return; // navegador interno (ha pisado el admin)
    const vp = window.innerWidth < 768 ? "movil" : "desktop";
    let clicks = 0;
    let maxScroll = 0;
    let t0 = Date.now();
    let pathActual = location.pathname;
    let enviado = false;

    const enviar = (data: Record<string, unknown>) => {
      try {
        const body = JSON.stringify(data);
        if (navigator.sendBeacon) navigator.sendBeacon("/api/t", new Blob([body], { type: "application/json" }));
        else fetch("/api/t", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
      } catch { /* nada */ }
    };

    const medirScroll = () => {
      const dh = document.documentElement.scrollHeight - window.innerHeight;
      const p = dh > 0 ? Math.round((100 * window.scrollY) / dh) : 100;
      if (p > maxScroll) maxScroll = Math.min(100, p);
    };

    const flush = () => {
      if (enviado) return;
      enviado = true;
      medirScroll();
      enviar({ tipo: "engagement", path: pathActual, vp, scroll: maxScroll, seg: Math.round((Date.now() - t0) / 1000) });
    };

    const onClick = (e: MouseEvent) => {
      if (clicks >= 30) return; // tope por carga de página
      clicks++;
      pathActual = location.pathname;
      const doc = document.documentElement;
      const x = Math.round((1000 * e.clientX) / window.innerWidth) / 10;
      const y = Math.round((1000 * (e.clientY + window.scrollY)) / Math.max(1, doc.scrollHeight)) / 10;
      const raw = e.target as HTMLElement | null;
      const el = (raw?.closest?.("button,a,input,select,textarea,label,summary,[role=button]") as HTMLElement | null) || raw;
      let desc = el ? el.tagName.toLowerCase() : "?";
      if (el?.id) desc += "#" + el.id;
      const txt = (el?.textContent || (el as HTMLInputElement | null)?.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 40);
      if (txt) desc += " «" + txt + "»";
      enviar({ tipo: "click", path: pathActual, vp, x, y, el: desc });
    };

    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    medirScroll();
    window.addEventListener("scroll", medirScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("scroll", medirScroll);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
