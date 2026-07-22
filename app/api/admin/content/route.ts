import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.redirect(new URL("/login", base), { status: 303 });

  const f = await req.formData();
  const prisma = await getPrisma();
  for (const [key, value] of f.entries()) {
    if (typeof value !== "string") continue;
    // Solo actualiza claves que existen (evita crear basura).
    await prisma.siteContent.updateMany({ where: { key }, data: { value } });
  }
  return NextResponse.redirect(new URL("/admin?saved=1", base), { status: 303 });
}
