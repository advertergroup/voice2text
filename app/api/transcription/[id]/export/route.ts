import { getPrisma } from "../../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../../src/auth/session.ts";
import { toTxt, toSrt, toDocx, toPdf, EXPORTS } from "../../../../../src/lib/export.ts";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const fmt = new URL(req.url).searchParams.get("format") || "txt";
  const spec = EXPORTS[fmt];
  if (!spec) return new Response("Formato no soportado", { status: 400 });

  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id } });
  if (!tr || tr.userId !== user.id) return new Response("No encontrado", { status: 404 });
  if (tr.locked) return new Response("Bloqueada: activa el plan para descargar", { status: 403 });

  const segs = Array.isArray(tr.segmentos) ? tr.segmentos as { start: number; end: number; text: string }[] : [];
  let body: Buffer;
  if (fmt === "txt") body = toTxt(tr.texto);
  else if (fmt === "srt") body = toSrt(segs);
  else if (fmt === "docx") body = await toDocx(tr.titulo, tr.texto);
  else body = toPdf(tr.titulo, tr.texto);

  const name = (tr.titulo || "transcripcion").replace(/\.[^.]+$/, "").replace(/[^\w.\-]+/g, "_").slice(0, 60) || "transcripcion";
  return new Response(new Uint8Array(body), {
    headers: { "content-type": spec.mime, "content-disposition": `attachment; filename="${name}.${spec.ext}"` },
  });
}
