import { NextResponse } from "next/server";
import { getPrisma } from "../../../src/db/client.ts";
import { SESSION_COOKIE, signSession, hashPassword } from "../../../src/auth/core.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const f = await req.formData();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  const nombre = String(f.get("nombre") ?? "").trim() || null;
  const plan = String(f.get("plan") ?? "").trim();
  if (!email || password.length < 6) return NextResponse.redirect(new URL("/register?error=1", base), { status: 303 });

  const prisma = await getPrisma();
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.redirect(new URL("/register?error=exists", base), { status: 303 });
  }
  const user = await prisma.user.create({ data: { email, nombre, passwordHash: hashPassword(password), role: "USER" } });
  const dest = plan ? `/api/checkout?plan=${encodeURIComponent(plan)}` : "/dashboard?welcome=1";
  const res = NextResponse.redirect(new URL(dest, base), { status: 303 });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
