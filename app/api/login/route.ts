import { NextResponse } from "next/server";
import { getPrisma } from "../../../src/db/client.ts";
import { SESSION_COOKIE, signSession, verifyPassword } from "../../../src/auth/core.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const f = await req.formData();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.redirect(new URL("/login?error=1", base), { status: 303 });
  }
  const res = NextResponse.redirect(new URL(user.role === "ADMIN" ? "/admin" : "/dashboard", base), { status: 303 });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
