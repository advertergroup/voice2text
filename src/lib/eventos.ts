import { getPrisma } from "../db/client.ts";

/**
 * Analítica propia (tabla Evento):
 *  - "pageview": lo envía el middleware (waitUntil → POST /api/t con CRON_SECRET) por cada página servida.
 *  - "offer_shown": beacon del navegador al mostrar la oferta de salida en /pay.
 *  - "offer_accepted" / "purchase" / "upgrade": los registra el servidor donde ocurren.
 * El panel /admin/analytics agrega esta tabla + Transcription + SupportLog + Stripe.
 */

export const TIPOS_EVENTO = ["pageview", "offer_shown", "offer_accepted", "purchase", "upgrade"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Bots/monitores: sus visitas no cuentan. */
export const RE_BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pagespeed|pingdom|uptime|monitor|scanner|curl|wget|python-requests|python-urllib|go-http|okhttp|axios|node-fetch|dataprovider|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|amazonbot|applebot/i;

const corta = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : null);

/** Inserta un evento; nunca lanza (la analítica jamás rompe el flujo). */
export async function registrarEvento(e: {
  tipo: TipoEvento; vid?: string | null; userId?: string | null; trId?: string | null;
  path?: string | null; locale?: string | null; origen?: string | null; referer?: string | null;
  valorCent?: number | null; meta?: string | null;
}): Promise<void> {
  try {
    const prisma = await getPrisma();
    await prisma.evento.create({
      data: {
        tipo: e.tipo,
        vid: corta(e.vid, 64), userId: corta(e.userId, 64), trId: corta(e.trId, 64),
        path: corta(e.path, 200), locale: corta(e.locale, 8),
        origen: e.origen === "ads" ? "ads" : null,
        referer: corta(e.referer, 300),
        valorCent: typeof e.valorCent === "number" && Number.isFinite(e.valorCent) ? Math.round(e.valorCent) : null,
        meta: corta(e.meta, 200),
      },
    });
  } catch (err) {
    console.warn("[eventos]", err instanceof Error ? err.message : err);
  }
}
