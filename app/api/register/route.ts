import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "../../../src/db/client.ts";
import { SESSION_COOKIE, signSession, hashPassword } from "../../../src/auth/core.ts";
import { ANON_COOKIE } from "../../../src/lib/funnel.ts";

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

  // Reclama las transcripciones que subió de forma anónima.
  const anon = (await cookies()).get(ANON_COOKIE)?.value;
  if (anon) await prisma.transcription.updateMany({ where: { anonSession: anon }, data: { userId: user.id, anonSession: null } }).catch(() => {});

  const dest = plan ? `/api/checkout?plan=${encodeURIComponent(plan)}` : "/dashboard?welcome=1";
  const res = NextResponse.redirect(new URL(dest, base), { status: 303 });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  if (anon) res.cookies.set(ANON_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
