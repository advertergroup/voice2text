import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.redirect(new URL("/login", base), { status: 303 });

  const f = await req.formData();
  const porId: Record<string, Record<string, string>> = {};
  for (const [k, v] of f.entries()) {
    if (typeof v !== "string") continue;
    const i = k.indexOf("__"); if (i < 0) continue;
    (porId[k.slice(0, i)] ??= {})[k.slice(i + 2)] = v;
  }
  const prisma = await getPrisma();
  for (const [id, d] of Object.entries(porId)) {
    await prisma.landingPage.update({ where: { id }, data: { titulo: d.titulo, subtitulo: d.subtitulo, cuerpo: d.cuerpo, metaDesc: d.metaDesc || "", activo: d.activo === "on" } }).catch(() => {});
  }
  return NextResponse.redirect(new URL("/admin/landings?saved=1", base), { status: 303 });
}
