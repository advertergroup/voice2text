import { NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";
import { transcribe, probeDuration, extraerPreview } from "../../../../src/lib/transcribe.ts";
import { ALLOWED_EXT, sniffMedia, extSegura } from "../../../../src/lib/upload-guard.ts";
import { PREVIEW_SECONDS, PREVIEW_WORDS, FILE_RETENTION_HOURS, esPagado, recortarPalabras } from "../../../../src/lib/funnel.ts";
import { sendMail } from "../../../../src/lib/mailer.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = join(process.cwd(), "uploads");

/** El admin sube el archivo de una transcripción MANUAL → se procesa con el pipeline normal del funnel. */
export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ ok: false, error: "no admin" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id }, include: { user: true } });
  if (!tr || tr.status !== "MANUAL") return NextResponse.json({ ok: false, error: "no existe o no es manual" }, { status: 404 });

  const f = await req.formData();
  const file = f.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file) || (file as File).size === 0) return NextResponse.json({ ok: false, error: "sin archivo" }, { status: 400 });
  const blob = file as File;
  const ext = extSegura(blob.name || "");
  if (!ALLOWED_EXT.has(ext)) return NextResponse.json({ ok: false, error: "tipo no válido" }, { status: 400 });
  const buf = Buffer.from(await blob.arrayBuffer());
  if (!sniffMedia(buf)) return NextResponse.json({ ok: false, error: "no es audio/vídeo real" }, { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fileKey = `${randomUUID()}${ext}`;
  await writeFile(join(UPLOAD_DIR, fileKey), buf);

  const paid = esPagado(tr.user);
  await prisma.transcription.update({
    where: { id: tr.id },
    data: { status: "PROCESSING", fileKey, fileDeleted: false, partial: false,
      fileExpiresAt: paid ? null : new Date(Date.now() + FILE_RETENTION_HOURS * 3600e3) },
  });

  // Procesado en segundo plano, igual que el pipeline de subida normal.
  void (async () => {
    const path = join(UPLOAD_DIR, fileKey);
    try {
      const dur = await probeDuration(path);
      if (paid) {
        const r = await transcribe(path, { language: tr.language, mode: tr.mode, originalName: tr.titulo });
        await prisma.transcription.update({ where: { id: tr.id }, data: { texto: r.text, segmentos: r.segments as any, duracionSeg: dur ?? r.durationSec ?? null, locked: false, status: "DONE", fileDeleted: true } });
        await rm(path, { force: true }).catch(() => {});
      } else {
        const { path: pv, tmp } = await extraerPreview(path, PREVIEW_SECONDS);
        const r = await transcribe(pv, { language: tr.language, mode: tr.mode, originalName: tr.titulo });
        await rm(tmp, { recursive: true, force: true }).catch(() => {});
        // El archivo se CONSERVA (fileExpiresAt) → al pagar, unlockUser transcribe el resto sin pedir resubida.
        await prisma.transcription.update({ where: { id: tr.id }, data: { preview: recortarPalabras(r.text, PREVIEW_WORDS), duracionSeg: dur ?? null, locked: true, status: "DONE" } });
      }
      // Aviso al usuario si dejó email.
      if (tr.contactEmail) {
        const base = process.env.APP_URL || "https://voicetotexts.net";
        await sendMail(tr.contactEmail, "✅ Your transcription is ready — Voice2Text",
          `<p>Your transcription is ready.</p><p><a href="${base}/r/${tr.id}">Open your transcription</a></p>`);
      }
    } catch (e) {
      await prisma.transcription.update({ where: { id: tr.id }, data: { status: "ERROR", error: e instanceof Error ? e.message : "error" } }).catch(() => {});
      await rm(path, { force: true }).catch(() => {});
    }
  })();

  return NextResponse.json({ ok: true });
}
