/** Cliente Prisma compartido (dashboard/API/admin). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;
export async function getPrisma() {
  if (_prisma) return _prisma;
  const { PrismaClient } = await import("@prisma/client");
  _prisma = new PrismaClient();
  return _prisma;
}
