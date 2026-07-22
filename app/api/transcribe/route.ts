import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getPrisma } from "../../../src/db/client.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { transcribe, descargarDeUrl } from "../../../src/lib/transcribe.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = join(process.cwd(), "uploads");

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
    titulo = blob.name || "audio";
    await mkdir(UPLOAD_DIR, { recursive: true });
    const safe = titulo.replace(/[^\w.\-]+/g, "_");
    filePath = join(UPLOAD_DIR, `${Date.now()}_${safe}`);
    await writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
  } else if (url) {
    sourceType = "URL"; sourceUrl = url; titulo = url.slice(0, 120);
  } else {
    return NextResponse.redirect(new URL("/dashboard?error=nofile", base), { status: 303 });
  }

  const trans = await prisma.transcription.create({
    data: { userId: user.id, titulo, sourceType, sourceUrl, language, mode, status: "PROCESSING" },
  });

  // Procesa en segundo plano y actualiza el registro (la página del detalle refresca hasta que esté).
  void (async () => {
    try {
      let path = filePath;
      if (!path && sourceUrl) path = await descargarDeUrl(sourceUrl);
      const r = await transcribe(path!, { language, mode, originalName: titulo });
      await prisma.transcription.update({ where: { id: trans.id }, data: { texto: r.text, segmentos: r.segments, duracionSeg: r.durationSec ?? null, status: "DONE" } });
    } catch (e) {
      await prisma.transcription.update({ where: { id: trans.id }, data: { status: "ERROR", error: e instanceof Error ? e.message : "error" } }).catch(() => {});
    }
  })();

  return NextResponse.redirect(new URL(`/dashboard/${trans.id}`, base), { status: 303 });
}
