import { NextResponse } from "next/server";
import { runRecovery } from "../../../../src/lib/recovery.ts";
import { cleanupExpired } from "../../../../src/lib/funnel.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Tick de mantenimiento (lo llama el cron del VPS): emails de recuperación + borrado de archivos caducados. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const enviados = await runRecovery();
  await cleanupExpired();
  return NextResponse.json({ ok: true, enviados });
}
