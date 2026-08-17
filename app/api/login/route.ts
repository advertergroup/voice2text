import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "../../../src/db/client.ts";
import { SESSION_COOKIE, signSession, verifyPassword } from "../../../src/auth/core.ts";
import { ANON_COOKIE } from "../../../src/lib/funnel.ts";

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
  // Reclama las transcripciones subidas de forma anónima antes de entrar.
  const anon = (await cookies()).get(ANON_COOKIE)?.value;
  if (anon) await prisma.transcription.updateMany({ where: { anonSession: anon }, data: { userId: user.id, anonSession: null } }).catch(() => {});

  const res = NextResponse.redirect(new URL(user.role === "ADMIN" ? "/admin" : "/dashboard", base), { status: 303 });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  if (anon) res.cookies.set(ANON_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
