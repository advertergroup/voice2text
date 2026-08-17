import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "../../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../../src/auth/session.ts";
import { ANON_COOKIE } from "../../../../../src/lib/funnel.ts";

export const runtime = "nodejs";

/** Estado de una transcripción (para el sondeo de la barra de progreso). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id }, select: { id: true, status: true, locked: true, userId: true, anonSession: true } });
  if (!tr) return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  const user = await getCurrentUser();
  const anon = (await cookies()).get(ANON_COOKIE)?.value;
  const owns = (user && tr.userId === user.id) || (!!tr.anonSession && !!anon && tr.anonSession === anon);
  if (!owns) return NextResponse.json({ status: "FORBIDDEN" }, { status: 404 });
  return NextResponse.json({ status: tr.status, locked: tr.locked });
}
