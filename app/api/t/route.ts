import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { registrarEvento, RE_BOT } from "../../../src/lib/eventos.ts";

export const runtime = "nodejs";

/**
 * Ingesta de eventos de analítica.
 *  - "pageview": solo desde el middleware (exige k = CRON_SECRET).
 *  - "offer_shown": beacon público del checkout (los demás datos salen de las cookies, no del cuerpo).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const tipo = String(body.tipo || "");

  if (tipo === "pageview") {
    if (!process.env.CRON_SECRET || body.k !== process.env.CRON_SECRET) return NextResponse.json({ ok: false }, { status: 403 });
    await registrarEvento({
      tipo: "pageview",
      vid: body.vid as string, path: body.path as string, locale: body.locale as string,
      origen: body.origen as string, referer: body.referer as string,
    });
    return NextResponse.json({ ok: true });
  }

  if (tipo === "offer_shown") {
    const ua = req.headers.get("user-agent") || "";
    if (RE_BOT.test(ua)) return NextResponse.json({ ok: true });
    const jar = await cookies();
    await registrarEvento({
      tipo: "offer_shown",
      vid: jar.get("v2t_vid")?.value, origen: jar.get("v2t_src")?.value, path: "/pay",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
