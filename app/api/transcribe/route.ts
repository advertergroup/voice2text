import { NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../../src/db/client.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { transcribe, descargarDeUrl } from "../../../src/lib/transcribe.ts";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, ALLOWED_EXT, sniffMedia, extSegura, scanClamAV } from "../../../src/lib/upload-guard.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = join(process.cwd(), "uploads");
const err = (base: string, code: string) => NextResponse.redirect(new URL(`/dashboard?error=${code}`, base), { status: 303 });

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", base), { status: 303 });

  const f = await req.formData();
  const file = f.get("file");
  const url = String(f.get("url") ?? "").trim();
  const mode = (String(f.get("mode") ?? "STANDARD").toUpperCase()) as "FAST" | "STANDARD" | "PRO";
  const language = String(f.get("language") ?? "auto");

  const prisma = await getPrisma();
  let titulo = "", sourceType: "FILE" | "URL" = "FILE", sourceUrl: string | null = null, filePath: string | null = null;

  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const blob = file as File;
    titulo = (blob.name || "audio").slice(0, 200); // solo para mostrar; no se usa en el disco

    // 1) Tamaño
    if (blob.size > MAX_UPLOAD_BYTES) return err(base, `toobig&max=${MAX_UPLOAD_MB}`);

    // 2) Extensión permitida
    const ext = extSegura(blob.name || "");
    if (!ALLOWED_EXT.has(ext)) return err(base, "badtype");

    // 3) Contenido real (magic bytes) → rechaza ejecutables/scripts disfrazados
    const buf = Buffer.from(await blob.arrayBuffer());
    if (!sniffMedia(buf)) return err(base, "badtype");

    // 4) Guardado con nombre ALEATORIO (nunca el del usuario) → cero path-traversal
    await mkdir(UPLOAD_DIR, { recursive: true });
    filePath = join(UPLOAD_DIR, `${randomUUID()}${ext}`);
    await writeFile(filePath, buf);

    // 5) Antivirus opcional (ClamAV). Si detecta amenaza, se borra y se rechaza.
    try {
      await scanClamAV(filePath);
    } catch (e) {
      await rm(filePath, { force: true }).catch(() => {});
      return err(base, "infected");
    }
  } else if (url) {
    sourceType = "URL"; sourceUrl = url; titulo = url.slice(0, 120);
  } else {
    return err(base, "nofile");
  }

  const trans = await prisma.transcription.create({
    data: { userId: user.id, titulo, sourceType, sourceUrl, language, mode, status: "PROCESSING" },
  });

  // Procesa en segundo plano. Pase lo que pase, BORRA el archivo subido y los temporales.
  const uploadPath = filePath;
  void (async () => {
    let urlTmp: string | null = null;
    try {
      let path = uploadPath;
      if (!path && sourceUrl) { const d = await descargarDeUrl(sourceUrl); path = d.path; urlTmp = d.tmp; }
      const r = await transcribe(path!, { language, mode, originalName: titulo });
      await prisma.transcription.update({ where: { id: trans.id }, data: { texto: r.text, segmentos: r.segments, duracionSeg: r.durationSec ?? null, status: "DONE" } });
    } catch (e) {
      await prisma.transcription.update({ where: { id: trans.id }, data: { status: "ERROR", error: e instanceof Error ? e.message : "error" } }).catch(() => {});
    } finally {
      // Limpieza: se elimina el original y cualquier temporal, transcrito o no.
      if (uploadPath) await rm(uploadPath, { force: true }).catch(() => {});
      if (urlTmp) await rm(urlTmp, { recursive: true, force: true }).catch(() => {});
    }
  })();

  return NextResponse.redirect(new URL(`/dashboard/${trans.id}`, base), { status: 303 });
}
