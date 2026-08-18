import { NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";
import { transcribe, probeDuration } from "../../../../src/lib/transcribe.ts";
import { ALLOWED_EXT, sniffMedia, extSegura, scanClamAV } from "../../../../src/lib/upload-guard.ts";
import { esPagado } from "../../../../src/lib/funnel.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = join(process.cwd(), "uploads");
const FULL_MAX_BYTES = Number(process.env.FULL_MAX_MB || 2000) * 1024 * 1024; // subida completa (pagado)

/** Subida del archivo COMPLETO tras pagar (archivos grandes cuya preview fue parcial). Transcribe entero. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !esPagado(user)) return NextResponse.json({ ok: false, error: "unpaid" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id } });
  if (!tr || tr.userId !== user.id || tr.locked) return NextResponse.json({ ok: false, error: "notfound" }, { status: 404 });

  const f = await req.formData();
  const file = f.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file) || (file as File).size === 0) return NextResponse.json({ ok: false, error: "nofile" }, { status: 400 });
  const blob = file as File;
  if (blob.size > FULL_MAX_BYTES) return NextResponse.json({ ok: false, error: "toobig" }, { status: 400 });
  const ext = extSegura(blob.name || "");
  if (!ALLOWED_EXT.has(ext)) return NextResponse.json({ ok: false, error: "badtype" }, { status: 400 });
  const buf = Buffer.from(await blob.arrayBuffer());
  if (!sniffMedia(buf)) return NextResponse.json({ ok: false, error: "badtype" }, { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fileKey = `${randomUUID()}${ext}`;
  await writeFile(join(UPLOAD_DIR, fileKey), buf);
  try { await scanClamAV(join(UPLOAD_DIR, fileKey)); }
  catch { await rm(join(UPLOAD_DIR, fileKey), { force: true }).catch(() => {}); return NextResponse.json({ ok: false, error: "infected" }, { status: 400 }); }

  await prisma.transcription.update({ where: { id: tr.id }, data: { status: "PROCESSING", partial: false, fileDeleted: false, fileKey, titulo: (blob.name || tr.titulo).slice(0, 200) } });

  // Transcribe el archivo completo en segundo plano.
  void (async () => {
    const path = join(UPLOAD_DIR, fileKey);
    try {
      const dur = await probeDuration(path);
      const r = await transcribe(path, { language: tr.language, mode: tr.mode, originalName: blob.name || tr.titulo });
      await prisma.transcription.update({ where: { id: tr.id }, data: { texto: r.text, segmentos: r.segments as any, duracionSeg: dur ?? r.durationSec ?? null, status: "DONE", fileDeleted: true } });
    } catch (e) {
      await prisma.transcription.update({ where: { id: tr.id }, data: { status: "ERROR", error: e instanceof Error ? e.message : "error" } }).catch(() => {});
    } finally {
      await rm(path, { force: true }).catch(() => {});
    }
  })();

  return NextResponse.json({ ok: true });
}
