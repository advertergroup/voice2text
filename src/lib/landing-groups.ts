import { localePath } from "./locale.ts";

export const SITE = "https://voicetotexts.net";

/**
 * Grupos de landings equivalentes entre idiomas (para hreflang y sitemap).
 * Cada grupo mapea locale → slug del mismo ángulo en ese idioma.
 */
export const GRUPOS_LANDING: Record<string, Record<string, string>> = {
  audio: { en: "audio-to-text", es: "audio-a-texto", it: "audio-in-testo", de: "audio-in-text", pl: "audio-na-tekst", el: "audio-se-keimeno" },
  mp3: { en: "mp3-to-text", es: "mp3-a-texto", it: "mp3-in-testo", de: "mp3-in-text", pl: "mp3-na-tekst", el: "mp3-se-keimeno" },
  youtube: { en: "youtube-to-text", es: "youtube-a-texto", it: "youtube-in-testo", de: "youtube-in-text", pl: "youtube-na-tekst", el: "youtube-se-keimeno" },
  tiktok: { en: "tiktok-to-text", es: "tiktok-a-texto", it: "tiktok-in-testo", de: "tiktok-in-text", pl: "tiktok-na-tekst", el: "tiktok-se-keimeno" },
};

/** URL absoluta de una landing (localePath resuelve el prefijo: es sin prefijo, resto /it, /de…). */
export function urlLanding(locale: string, slug: string): string {
  return SITE + localePath(locale, `/l/${slug}`);
}

/** Slug equivalente del mismo ángulo en otro idioma (null si no hay). */
export function slugEquivalente(slug: string, locale: string): string | null {
  for (const grupo of Object.values(GRUPOS_LANDING)) {
    if (Object.values(grupo).includes(slug)) return grupo[locale] || null;
  }
  return null;
}

/** Si el slug pertenece a un grupo, devuelve las alternativas por idioma (para hreflang). */
export function alternativasHreflang(slug: string): Record<string, string> | null {
  for (const grupo of Object.values(GRUPOS_LANDING)) {
    const localeDeEsteSlug = Object.entries(grupo).find(([, s]) => s === slug)?.[0];
    if (localeDeEsteSlug) {
      const out: Record<string, string> = {};
      for (const [loc, s] of Object.entries(grupo)) out[loc] = urlLanding(loc, s);
      return out;
    }
  }
  return null;
}
