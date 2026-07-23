import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";
import { isLocale, DEFAULT_LOCALE } from "../../../../src/lib/locale.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.redirect(new URL("/login", base), { status: 303 });

  const f = await req.formData();
  const rawLocale = f.get("__locale");
  const locale = isLocale(rawLocale) ? (rawLocale as string) : DEFAULT_LOCALE;

  const prisma = await getPrisma();
  for (const [key, value] of f.entries()) {
    if (key.startsWith("__")) continue;           // campos de control
    if (typeof value !== "string") continue;
    // Actualiza la fila (clave, idioma). Si no existe (idioma nuevo), la crea.
    const n = await prisma.siteContent.updateMany({ where: { key, locale }, data: { value } });
    if (n.count === 0) {
      await prisma.siteContent.create({ data: { key, locale, value, grupo: "General", label: key } }).catch(() => {});
    }
  }
  const q = locale !== DEFAULT_LOCALE ? `&lang=${locale}` : "";
  return NextResponse.redirect(new URL(`/admin?saved=1${q}`, base), { status: 303 });
}
