"use client";
import { useEffect } from "react";

/** Empuja un evento a GA4 (destino de la etiqueta AW) una vez por montaje. */
export function GaEvent({ nombre }: { nombre: string }) {
  useEffect(() => {
    try { (window as any).gtag?.("event", nombre); } catch { /* sin gtag (bloqueador): nada */ }
  }, [nombre]);
  return null;
}
