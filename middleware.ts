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
    if (nuevoVid) res.cookies.set(VID_COOKIE, vid, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  };

  // Pageview (fuera del camino crítico, tras responder). Sin bots, sin prefetch, solo GET servidos (no redirects).
  const registrar = (path: string, locale: string) => {
    const ua = req.headers.get("user-agent") || "";
    const esPrefetch = req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch" || (req.headers.get("sec-purpose") || "").includes("prefetch");
    if (req.method !== "GET" || esPrefetch || RE_BOT.test(ua) || sp.has("hm")) return; // ?hm=1 = iframe del mapa de calor del admin
    if (req.cookies.get("v2t_int") || path.startsWith("/admin")) return; // tráfico interno (Daniel) fuera de la analítica
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
        }),
      }).then((r) => { if (!r.ok) console.warn("[analytics] beacon", r.status); })
        .catch((e) => console.warn("[analytics] beacon", e instanceof Error ? e.message : e))
    );
  };

  // Área privada / checkout → no tocar (pero deja pasar, marcando ads si procede).
  if (NO_I18N.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    registrar(pathname, "");
    return finish(NextResponse.next());
  }

  const { locale, rest } = stripLocale(pathname);

  // Caso 1: la URL trae prefijo de idioma (/en/...). Reescribe a la ruta real + inyecta x-locale.
  if (locale !== DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = rest;
    const headers = new Headers(req.headers);
    headers.set("x-locale", locale);
    headers.set("x-pathname", rest);
    const res = NextResponse.rewrite(url, { request: { headers } });
    res.cookies.set(LANG_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    registrar(rest || "/", locale);
    return finish(res);
  }

  // Caso 2: sin prefijo → idioma por defecto (es), salvo que el usuario prefiera otro
  // (cookie o navegador) y aún no lo hayamos fijado → redirige a la versión con prefijo.
  const cookieLang = req.cookies.get(LANG_COOKIE)?.value;
  const preferred = LOCALE_CODES.includes(cookieLang || "")
    ? cookieLang!
    : detectFromAcceptLanguage(req.headers.get("accept-language"));

  if (preferred && preferred !== DEFAULT_LOCALE && LOCALE_CODES.includes(preferred)) {
    const url = req.nextUrl.clone();
    url.pathname = (pathname === "/" ? "" : pathname);
    url.pathname = "/" + preferred + url.pathname;
    url.search = search;
    return finish(NextResponse.redirect(url)); // el pageview se registra al servir la URL destino
  }

  // Idioma base: sirve tal cual, marcando x-locale=es.
  const headers = new Headers(req.headers);
  headers.set("x-locale", DEFAULT_LOCALE);
  headers.set("x-pathname", pathname);
  registrar(pathname, DEFAULT_LOCALE);
  return finish(NextResponse.next({ request: { headers } }));
}

export const config = {
  // Excluye API, assets de Next y ficheros con extensión.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
