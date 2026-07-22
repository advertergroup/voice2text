import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

/** Auth mínima sin dependencias: scrypt para contraseñas + cookie de sesión firmada (HMAC). */
export const SESSION_COOKIE = "v2t_session";
const SECRET = () => process.env.AUTH_SECRET || "dev-insecure-secret-cambia-esto";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, dk] = stored.split(":");
  if (!salt || !dk) return false;
  const test = scryptSync(pw, salt, 64);
  const a = Buffer.from(dk, "hex");
  return a.length === test.length && timingSafeEqual(a, test);
}
export function signSession(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", SECRET()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { return (JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string }).uid; }
  catch { return null; }
}
