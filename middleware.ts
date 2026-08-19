import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DEFAULT_LOCALE, LOCALE_CODES, LANG_COOKIE,
  stripLocale, detectFromAcceptLanguage,
} from "./src/lib/locale.ts";

// Rutas que NO se localizan (área privada / checkout). Se sirven siempre sin prefijo.
const NO_I18N = ["/dashboard", "/account", "/admin", "/pay", "/thanks"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ¿Tráfico de Google Ads? (gclid/gad_source o ?src=ads) → marca cookie para la versión "ads" del checkout.
  const sp = req.nextUrl.searchParams;
  const isAds = sp.has("gclid") || sp.has("gad_source") || sp.get("src") === "ads";
  const withAds = (res: NextResponse) => { if (isAds) res.cookies.set("v2t_src", "ads", { path: "/", maxAge: 60 * 60 * 24 * 30 }); return res; };

  // Área privada / checkout → no tocar (pero deja pasar, marcando ads si procede).
  if (NO_I18N.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return withAds(NextResponse.next());
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
    return withAds(res);
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
    return withAds(NextResponse.redirect(url));
  }

  // Idioma base: sirve tal cual, marcando x-locale=es.
  const headers = new Headers(req.headers);
  headers.set("x-locale", DEFAULT_LOCALE);
  headers.set("x-pathname", pathname);
  return withAds(NextResponse.next({ request: { headers } }));
}

export const config = {
  // Excluye API, assets de Next y ficheros con extensión.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
