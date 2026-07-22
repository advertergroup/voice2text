import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { getCurrentUser } from "../../../../src/auth/session.ts";

export async function POST(req: Request) {
  const base = process.env.APP_URL || req.url;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.redirect(new URL("/login", base), { status: 303 });

  const f = await req.formData();
  // Agrupa por id: "<id>__campo".
  const porId: Record<string, Record<string, string>> = {};
  for (const [k, v] of f.entries()) {
    if (typeof v !== "string") continue;
    const i = k.indexOf("__");
    if (i < 0) continue;
    const id = k.slice(0, i), campo = k.slice(i + 2);
    (porId[id] ??= {})[campo] = v;
  }
  const prisma = await getPrisma();
  for (const [id, d] of Object.entries(porId)) {
    await prisma.plan.update({
      where: { id },
      data: {
        nombre: d.nombre, periodo: d.periodo, badge: d.badge || null, botonTexto: d.botonTexto,
        stripePriceId: d.stripePriceId || null, descripcion: d.descripcion || null,
        precioCent: Math.round(parseFloat(d.precioEur || "0") * 100),
        caracteristicas: (d.caracteristicas || "").split("\n").map((s) => s.trim()).filter(Boolean),
        destacado: d.destacado === "on", activo: d.activo === "on",
      },
    }).catch(() => {});
  }
  return NextResponse.redirect(new URL("/admin/plans?saved=1", base), { status: 303 });
}
