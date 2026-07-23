import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DEFAULT_LOCALE, LOCALE_CODES, LANG_COOKIE,
  stripLocale, detectFromAcceptLanguage,
} from "./src/lib/locale.ts";

// Rutas que NO se localizan (área privada / logueados). Se sirven siempre en el idioma base.
const NO_I18N = ["/dashboard", "/account", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Área privada → no tocar (pero deja pasar).
  if (NO_I18N.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
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
    return res;
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
    return NextResponse.redirect(url);
  }

  // Idioma base: sirve tal cual, marcando x-locale=es.
  const headers = new Headers(req.headers);
  headers.set("x-locale", DEFAULT_LOCALE);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Excluye API, assets de Next y ficheros con extensión.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
