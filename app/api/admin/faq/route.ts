import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.redirect(new URL("/login", base), { status: 303 });

  const f = await req.formData();
  const locale = (f.get("formlocale") as string) || "es";
  const porId: Record<string, Record<string, string>> = {};
  for (const [k, v] of f.entries()) {
    if (typeof v !== "string") continue;
    const i = k.indexOf("__"); if (i < 0) continue;
    (porId[k.slice(0, i)] ??= {})[k.slice(i + 2)] = v;
  }
  const prisma = await getPrisma();
  for (const [id, d] of Object.entries(porId)) {
    if (id === "new") {
      if (d.pregunta?.trim()) await prisma.faqItem.create({ data: { pregunta: d.pregunta.trim(), respuesta: (d.respuesta || "").trim(), orden: 99, locale } });
      continue;
    }
    if (d.delete === "on") { await prisma.faqItem.delete({ where: { id } }).catch(() => {}); continue; }
    await prisma.faqItem.update({ where: { id }, data: { pregunta: d.pregunta, respuesta: d.respuesta, orden: parseInt(d.orden || "0") || 0, activo: d.activo === "on" } }).catch(() => {});
  }
  const q = locale !== "es" ? `&lang=${locale}` : "";
  return NextResponse.redirect(new URL(`/admin/faq?saved=1${q}`, base), { status: 303 });
}
