import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { registrarEvento, RE_BOT } from "../../../src/lib/eventos.ts";

export const runtime = "nodejs";

/**
 * Ingesta de eventos de analítica.
 *  - "pageview": solo desde el middleware (exige k = CRON_SECRET).
 *  - "offer_shown" | "click" | "engagement": beacons públicos del navegador
 *    (identidad por cookies; los números se acotan; los bots no cuentan).
 */

const clamp = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : 0;
};

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

  if (tipo === "offer_shown" || tipo === "click" || tipo === "engagement") {
    const ua = req.headers.get("user-agent") || "";
    if (RE_BOT.test(ua)) return NextResponse.json({ ok: true });
    const jar = await cookies();
    const vid = jar.get("v2t_vid")?.value;
    const origen = jar.get("v2t_src")?.value;
    const vp = body.vp === "movil" ? "movil" : "desktop";
    const path = typeof body.path === "string" ? body.path.slice(0, 200) : null;

    if (tipo === "offer_shown") {
      await registrarEvento({ tipo: "offer_shown", vid, origen, path: "/pay" });
    } else if (tipo === "click") {
      const el = typeof body.el === "string" ? body.el.slice(0, 90) : "";
      await registrarEvento({
        tipo: "click", vid, origen, path,
        meta: JSON.stringify({ x: clamp(body.x, 0, 100), y: clamp(body.y, 0, 100), vp, el }),
      });
    } else {
      await registrarEvento({
        tipo: "engagement", vid, origen, path,
        valorCent: Math.min(7200, Math.max(0, Math.round(Number(body.seg) || 0))), // segundos en página
        meta: JSON.stringify({ scroll: clamp(body.scroll, 0, 100), vp }),
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
