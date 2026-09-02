"use client";
import { useEffect } from "react";

/**
 * Marca el navegador como INTERNO (v2t_int=1, 1 año) al pisar cualquier página
 * del admin: la analítica propia (pageviews, clicks, engagement, avisos) lo
 * ignora desde entonces. Evita que el propio Daniel infle visitas y heatmap.
 */
export function MarcaInterno() {
  useEffect(() => {
    try { document.cookie = "v2t_int=1;path=/;max-age=31536000;SameSite=Lax"; } catch { /* nada */ }
  }, []);
  return null;
}
