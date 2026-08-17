import { redirect } from "next/navigation";
import { loadContent, t, getLocale } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { Resultado } from "../../../src/ui/Resultado.tsx";

export const dynamic = "force-dynamic";

export default async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id } });
  if (!tr || tr.userId !== user.id) redirect("/dashboard");

  const plan = await prisma.plan.findFirst({ where: { key: "premium", locale: "es" } });
  const precio = plan ? (plan.precioCent / 100).toLocaleString(locale, { minimumFractionDigits: 2 }) + " €/mes" : "";

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="dash">
      <a href="/dashboard" className="muted" style={{ fontSize: 14 }}>← Volver</a>
      <Resultado tr={tr as any} c={c} locale={locale} precio={precio} ctaHref="/api/checkout?plan=premium" />
    </AppShell>
  );
}
