import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "../../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../../src/auth/session.ts";
import { ANON_COOKIE } from "../../../../../src/lib/funnel.ts";

export const runtime = "nodejs";

/** Guarda el email de aviso para una transcripción manual (dueño o sesión anónima). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false }, { status: 400 });
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id }, select: { id: true, userId: true, anonSession: true } });
  if (!tr) return NextResponse.json({ ok: false }, { status: 404 });
  const user = await getCurrentUser();
  const anon = (await cookies()).get(ANON_COOKIE)?.value;
  const owns = (user && tr.userId === user.id) || (!!tr.anonSession && !!anon && tr.anonSession === anon);
  if (!owns) return NextResponse.json({ ok: false }, { status: 404 });
  await prisma.transcription.update({ where: { id }, data: { contactEmail: email.toLowerCase().slice(0, 200) } });
  return NextResponse.json({ ok: true });
}
