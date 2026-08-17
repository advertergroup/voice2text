import { NextResponse } from "next/server";
import { writeFile, mkdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getPrisma } from "../../../src/db/client.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { transcribe, descargarDeUrl, probeDuration, extraerPreview } from "../../../src/lib/transcribe.ts";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, ALLOWED_EXT, sniffMedia, extSegura, scanClamAV } from "../../../src/lib/upload-guard.ts";
import { PREVIEW_SECONDS, FILE_RETENTION_HOURS, ANON_UPLOAD_LIMIT, ANON_COOKIE, esPagado, cleanupExpired } from "../../../src/lib/funnel.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = join(process.cwd(), "uploads");

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  await cleanupExpired(); // limpieza oportunista de archivos caducados

  const user = await getCurrentUser();
  const jar = await cookies();
  let anon = jar.get(ANON_COOKIE)?.value || null;
  let setAnon = false;
  if (!user && !anon) { anon = randomUUID(); setAnon = true; }

  const backUrl = user ? "/dashboard" : "/";
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`${backUrl}?uperr=${code}`, base), { status: 303 });
    if (setAnon && anon) res.cookies.set(ANON_COOKIE, anon, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;
  };

  const f = await req.formData();
  const file = f.get("file");
  const url = String(f.get("url") ?? "").trim();
  const mode = (String(f.get("mode") ?? "STANDARD").toUpperCase()) as "FAST" | "STANDARD" | "PRO";
  const language = String(f.get("language") ?? "auto");
  const prisma = await getPrisma();

  // Límite anti-abuso para subidas anónimas.
  if (!user && anon) {
    const desde = new Date(Date.now() - 3600e3);
    const n = await prisma.transcription.count({ where: { anonSession: anon, createdAt: { gt: desde } } });
    if (n >= ANON_UPLOAD_LIMIT) return fail("limit");
  }

  let titulo = "", sourceType: "FILE" | "URL" = "FILE", sourceUrl: string | null = null, fileKey: string | null = null;

  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const blob = file as File;
    titulo = (blob.name || "audio").slice(0, 200);
    if (blob.size > MAX_UPLOAD_BYTES) return fail(`toobig&max=${MAX_UPLOAD_MB}`);
    const ext = extSegura(blob.name || "");
    if (!ALLOWED_EXT.has(ext)) return fail("badtype");
    const buf = Buffer.from(await blob.arrayBuffer());
    if (!sniffMedia(buf)) return fail("badtype");
    await mkdir(UPLOAD_DIR, { recursive: true });
    fileKey = `${randomUUID()}${ext}`;
    await writeFile(join(UPLOAD_DIR, fileKey), buf);
    try { await scanClamAV(join(UPLOAD_DIR, fileKey)); }
    catch { await rm(join(UPLOAD_DIR, fileKey), { force: true }).catch(() => {}); return fail("infected"); }
  } else if (url) {
    sourceType = "URL"; sourceUrl = url; titulo = url.slice(0, 120);
  } else {
    return fail("nofile");
  }

  const paid = esPagado(user);
  const trans = await prisma.transcription.create({
    data: {
      userId: user?.id ?? null, anonSession: user ? null : anon,
      titulo, sourceType, sourceUrl, language, mode, status: "PROCESSING",
      locked: !paid, previewSeg: PREVIEW_SECONDS, fileKey,
      fileExpiresAt: paid ? null : new Date(Date.now() + FILE_RETENTION_HOURS * 3600e3),
    },
  });

  // Procesado en segundo plano: PAGADO = completo; si no = solo preview (ahorra CPU) y se guarda el archivo.
  void (async () => {
    let workPath = fileKey ? join(UPLOAD_DIR, fileKey) : null;
    let urlTmp: string | null = null;
    try {
      if (!workPath && sourceUrl) {
        const d = await descargarDeUrl(sourceUrl); urlTmp = d.tmp;
        const fk = `${randomUUID()}.mp3`;
        await copyFile(d.path, join(UPLOAD_DIR, fk)); // se conserva para transcribir el resto al pagar
        await prisma.transcription.update({ where: { id: trans.id }, data: { fileKey: fk } });
        workPath = join(UPLOAD_DIR, fk);
      }
      const dur = await probeDuration(workPath!);
      if (paid) {
        const r = await transcribe(workPath!, { language, mode, originalName: titulo });
        await prisma.transcription.update({ where: { id: trans.id }, data: { texto: r.text, segmentos: r.segments as any, duracionSeg: dur ?? r.durationSec ?? null, locked: false, status: "DONE", fileDeleted: true } });
        await rm(workPath!, { force: true }).catch(() => {});
      } else {
        const { path: pv, tmp } = await extraerPreview(workPath!, PREVIEW_SECONDS);
        const r = await transcribe(pv, { language, mode, originalName: titulo });
        await rm(tmp, { recursive: true, force: true }).catch(() => {});
        await prisma.transcription.update({ where: { id: trans.id }, data: { preview: r.text, duracionSeg: dur ?? null, locked: true, status: "DONE" } });
      }
    } catch (e) {
      await prisma.transcription.update({ where: { id: trans.id }, data: { status: "ERROR", error: e instanceof Error ? e.message : "error" } }).catch(() => {});
    } finally {
      if (urlTmp) await rm(urlTmp, { recursive: true, force: true }).catch(() => {});
    }
  })();

  const res = NextResponse.redirect(new URL(`/r/${trans.id}`, base), { status: 303 });
  if (setAnon && anon) res.cookies.set(ANON_COOKIE, anon, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
