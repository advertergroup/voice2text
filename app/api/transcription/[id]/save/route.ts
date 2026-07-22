import { NextResponse } from "next/server";
import { getPrisma } from "../../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../../src/auth/session.ts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const { texto } = await req.json();
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id } });
  if (!tr || tr.userId !== user.id) return NextResponse.json({ ok: false }, { status: 404 });
  await prisma.transcription.update({ where: { id }, data: { texto: String(texto ?? "") } });
  return NextResponse.json({ ok: true });
}
