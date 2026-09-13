import type { MetadataRoute } from "next";
import { SITE, GRUPOS_LANDING, urlLanding } from "../src/lib/landing-groups.ts";
import { LOCALE_CODES } from "../src/lib/locale.ts";

/** Sitemap: home por idioma + las landings de campaña (con alternativas hreflang). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Home por idioma.
  for (const loc of LOCALE_CODES) {
    entries.push({ url: SITE + (loc === "es" ? "/" : `/${loc}`), lastModified: now, changeFrequency: "weekly", priority: 1 });
  }

  // Landings de campaña, con languages (hreflang) por grupo.
  for (const grupo of Object.values(GRUPOS_LANDING)) {
    const languages: Record<string, string> = {};
    for (const [loc, slug] of Object.entries(grupo)) languages[loc] = urlLanding(loc, slug);
    for (const [loc, slug] of Object.entries(grupo)) {
      entries.push({ url: urlLanding(loc, slug), lastModified: now, changeFrequency: "weekly", priority: 0.8, alternates: { languages } });
    }
  }

  return entries;
}
