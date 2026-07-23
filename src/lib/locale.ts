/**
 * Sistema de idiomas de Voice2Text.
 * - Idioma por defecto: `es` (se sirve en la raíz, sin prefijo → conserva las URLs actuales).
 * - Resto de idiomas: con prefijo en la URL (`/en`, `/pt`, …) para SEO y campañas internacionales.
 * El middleware detecta el idioma del prefijo (o del navegador) y lo pasa a las páginas
 * vía la cabecera `x-locale`.
 */

export const DEFAULT_LOCALE = "es" as const;

export interface LocaleInfo { code: string; label: string; native: string; flag: string }

// Orden = orden en el selector de idioma.
export const LOCALES: LocaleInfo[] = [
  { code: "es", label: "Español",    native: "Español",    flag: "🇪🇸" },
  { code: "en", label: "English",    native: "English",    flag: "🇬🇧" },
  { code: "pt", label: "Português",  native: "Português",  flag: "🇵🇹" },
  { code: "fr", label: "Français",   native: "Français",   flag: "🇫🇷" },
  { code: "de", label: "Deutsch",    native: "Deutsch",    flag: "🇩🇪" },
  { code: "it", label: "Italiano",   native: "Italiano",   flag: "🇮🇹" },
  { code: "nl", label: "Nederlands", native: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polski",     native: "Polski",     flag: "🇵🇱" },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);
export const LANG_COOKIE = "v2t_lang";

export function isLocale(x: unknown): x is string {
  return typeof x === "string" && LOCALE_CODES.includes(x);
}

export function localeInfo(code: string): LocaleInfo {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]!;
}

/**
 * Construye una ruta con el prefijo de idioma correcto.
 * `es` → sin prefijo ("/pricing"); otros → "/en/pricing".
 */
export function localePath(locale: string, path: string): string {
  const p = path.startsWith("/") ? path : "/" + path;
  if (locale === DEFAULT_LOCALE || !isLocale(locale)) return p;
  return p === "/" ? "/" + locale : "/" + locale + p;
}

/** Quita el prefijo de idioma de un pathname → { locale, rest }. */
export function stripLocale(pathname: string): { locale: string; rest: string } {
  const m = pathname.match(/^\/([a-z]{2})(\/.*|$)/);
  if (m && LOCALE_CODES.includes(m[1]!) && m[1] !== DEFAULT_LOCALE) {
    return { locale: m[1]!, rest: m[2] && m[2] !== "" ? m[2]! : "/" };
  }
  return { locale: DEFAULT_LOCALE, rest: pathname === "" ? "/" : pathname };
}

/** Detecta el mejor idioma soportado a partir de una cabecera Accept-Language. */
export function detectFromAcceptLanguage(header: string | null): string {
  if (!header) return DEFAULT_LOCALE;
  const parts = header.split(",").map((p) => {
    const [tag, q] = p.trim().split(";q=");
    return { tag: (tag || "").toLowerCase().slice(0, 2), q: q ? parseFloat(q) : 1 };
  });
  parts.sort((a, b) => b.q - a.q);
  for (const { tag } of parts) if (LOCALE_CODES.includes(tag)) return tag;
  return DEFAULT_LOCALE;
}
