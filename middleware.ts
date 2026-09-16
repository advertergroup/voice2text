import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import {
  DEFAULT_LOCALE, LOCALE_CODES, LANG_COOKIE,
  stripLocale, detectFromAcceptLanguage,
} from "./src/lib/locale.ts";

// Rutas que NO se localizan (área privada / checkout). Se sirven siempre sin prefijo.
const NO_I18N = ["/dashboard", "/account", "/admin", "/pay", "/thanks"];

const VID_COOKIE = "v2t_vid"; // visitante para la analítica propia (/admin/analytics)
const RE_BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pagespeed|pingdom|uptime|monitor|scanner|curl|wget|python-requests|python-urllib|go-http|okhttp|axios|node-fetch|dataprovider|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|amazonbot|applebot/i;
const COOKIE_LANG_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

/**
 * IDIOMA: LA URL MANDA. `/it/...` se sirve en italiano, `/l/audio-a-texto` (sin prefijo) se sirve en español,
 * y en ambos casos la cookie de idioma se ajusta a lo que se ha visto. NUNCA se redirige una página con prefijo ni una
 * página española por la cookie o el navegador: eso mandaba tráfico de anuncios en español a `/en/...` (página mezclada)
 * y hacía que el selector «Español» volviera al inglés. Única redirección automática: la portada `/`, según la cookie
 * (si la hay) o el idioma del navegador.
 */
export function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;

  // ¿Tráfico de Google Ads? (gclid/gad_source o ?src=ads) → marca cookie para la versión "ads" del checkout.
  const sp = req.nextUrl.searchParams;
  const isAds = sp.has("gclid") || sp.has("gad_source") || sp.get("src") === "ads";
  const esAds = isAds || req.cookies.get("v2t_src")?.value === "ads";

  // Visitante (analítica): cookie de 1 año, se crea aquí para contar únicos.
  let vid = req.cookies.get(VID_COOKIE)?.value || "";
  const nuevoVid = !vid;
  if (nuevoVid) vid = crypto.randomUUID();

  const finish = (res: NextResponse) => {
    if (isAds) res.cookies.set("v2t_src", "ads", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    // El VALOR del gclid, 90 días: se adjunta al pago (metadata.gclid) para poder
    // subir conversiones offline o auditar atribución más adelante.
    const gclid = sp.get("gclid");
    if (gclid) res.cookies.set("v2t_gclid", gclid.slice(0, 120), { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" });
    // Primer toque (90 días, NO se pisa): la query de la primera llegada con
    // utm_* o marca de Ads. De aquí salen campaña/keyword de subidas y pagos.
    if (!req.cookies.get("v2t_attr") && (isAds || /(^|[?&])utm_/.test(search))) {
      res.cookies.set("v2t_attr", search.slice(1, 301), { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" });
    }
    // ?int=1 = marca este navegador como INTERNO desde la primera petición
    // (para pruebas de compra en incógnito/móvil sin ensuciar la analítica).
    if (sp.has("int")) res.cookies.set("v2t_int", "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
    if (nuevoVid) res.cookies.set(VID_COOKIE, vid, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  };

  // Pageview (fuera del camino crítico, tras responder). Sin bots, sin prefetch, solo GET servidos (no redirects).
  const registrar = (path: string, locale: string) => {
    const ua = req.headers.get("user-agent") || "";
    const esPrefetch = req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch" || (req.headers.get("sec-purpose") || "").includes("prefetch");
    if (req.method !== "GET" || esPrefetch || RE_BOT.test(ua) || sp.has("hm")) return; // ?hm=1 = iframe del mapa de calor del admin
    // Tráfico interno fuera de la analítica. OJO: la cookie recién puesta no
    // viaja en ESTA petición → ?int=1 también se comprueba en la query.
    if (req.cookies.get("v2t_int") || sp.has("int") || path.startsWith("/admin")) return;
    // OJO: detrás de nginx `nextUrl.origin` es http:// → el 301 a https convertiría el POST en GET.
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || req.nextUrl.host;
    event.waitUntil(
      fetch(`${proto}://${host}/api/t`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tipo: "pageview", k: process.env.CRON_SECRET || "", vid, path, locale,
          origen: esAds ? "ads" : "", referer: req.headers.get("referer") || "",
          // La query completa de la llegada (gclid, gad_source, utm…): es la
          // prueba de qué parámetros trae de verdad cada clic de anuncio.
          q: search ? search.slice(0, 300) : "",
        }),
      }).then((r) => { if (!r.ok) console.warn("[analytics] beacon", r.status); })
        .catch((e) => console.warn("[analytics] beacon", e instanceof Error ? e.message : e))
    );
  };

  // Área privada / checkout → no tocar (pero deja pasar, marcando ads si procede). Su idioma sale de la cookie.
  if (NO_I18N.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    registrar(pathname, "");
    return finish(NextResponse.next());
  }

  const { locale, rest } = stripLocale(pathname);
  const cookieLang = req.cookies.get(LANG_COOKIE)?.value;

  // Caso 1: la URL trae prefijo de idioma (/en/...). Reescribe a la ruta real + inyecta x-locale. La cookie sigue a la URL.
  if (locale !== DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = rest;
    const headers = new Headers(req.headers);
    headers.set("x-locale", locale);
    headers.set("x-pathname", rest);
    const res = NextResponse.rewrite(url, { request: { headers } });
    if (cookieLang !== locale) res.cookies.set(LANG_COOKIE, locale, COOKIE_LANG_OPTS);
    registrar(rest || "/", locale);
    return finish(res);
  }

  // Caso 2: SOLO la portada "/" se redirige al idioma preferido (cookie, o navegador si no hay cookie).
  if (pathname === "/") {
    const preferred = LOCALE_CODES.includes(cookieLang || "") ? cookieLang! : detectFromAcceptLanguage(req.headers.get("accept-language"));
    if (preferred !== DEFAULT_LOCALE && LOCALE_CODES.includes(preferred)) {
      const url = req.nextUrl.clone();
      url.pathname = "/" + preferred;
      url.search = search;
      return finish(NextResponse.redirect(url)); // el pageview se registra al servir la URL destino
    }
  }

  // Caso 3: ruta sin prefijo = español, tal cual (landings de anuncios, selector «Español», enlaces directos). Cookie → es.
  const headers = new Headers(req.headers);
  headers.set("x-locale", DEFAULT_LOCALE);
  headers.set("x-pathname", pathname);
  registrar(pathname, DEFAULT_LOCALE);
  const res = NextResponse.next({ request: { headers } });
  if (cookieLang !== DEFAULT_LOCALE) res.cookies.set(LANG_COOKIE, DEFAULT_LOCALE, COOKIE_LANG_OPTS);
  return finish(res);
}

export const config = {
  // Excluye API, assets de Next y ficheros con extensión.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
