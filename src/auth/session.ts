import { cookies } from "next/headers";
import { getPrisma } from "../db/client.ts";
import { SESSION_COOKIE, verifySession } from "./core.ts";

/** Usuario autenticado a partir de la cookie (o null). */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const uid = verifySession(token);
  if (!uid) return null;
  const prisma = await getPrisma();
  return prisma.user.findUnique({ where: { id: uid } });
}
