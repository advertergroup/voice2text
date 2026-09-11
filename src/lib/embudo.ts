import { cookies } from "next/headers";
import { registrarEvento, type TipoEvento } from "./eventos.ts";
import { parseAttr } from "./attr.ts";

/**
 * Evento de embudo desde el SERVIDOR con la identidad de la sesión: vid,
 * origen ads, gclid y utm_term (cookie v2t_attr) en meta. Los navegadores
 * internos (v2t_int) no cuentan. Nunca lanza.
 */
export async function eventoEmbudo(tipo: TipoEvento, extra?: { trId?: string | null; path?: string | null }): Promise<void> {
  try {
    const jar = await cookies();
    if (jar.get("v2t_int")) return; // interno: fuera de la analítica
    const attr = parseAttr(jar.get("v2t_attr")?.value);
    const gclid = jar.get("v2t_gclid")?.value || "";
    await registrarEvento({
      tipo,
      vid: jar.get("v2t_vid")?.value,
      origen: jar.get("v2t_src")?.value,
      trId: extra?.trId ?? null,
      path: extra?.path ?? null,
      meta: JSON.stringify({ gclid: gclid.slice(0, 60), term: attr.term || "", camp: attr.campaign || "" }).slice(0, 200),
    });
  } catch { /* el embudo nunca rompe el flujo */ }
}
