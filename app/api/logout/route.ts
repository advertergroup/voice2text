import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../src/auth/core.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const res = NextResponse.redirect(new URL("/", base), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
