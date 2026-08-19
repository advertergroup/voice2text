import { NextResponse } from "next/server";
import { runSupport } from "../../../../src/lib/support.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Tick del agente de soporte (cron del VPS): procesa el buzón support@ (cancelaciones/reembolsos). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const r = await runSupport();
  return NextResponse.json({ ok: true, ...r });
}
