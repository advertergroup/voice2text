import { redirect } from "next/navigation";
import { loadContent, t, getLocale } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { Resultado } from "../../../src/ui/Resultado.tsx";
import { precioPara } from "../../../src/lib/precio.ts";
import { ui } from "../../../src/lib/ui.ts";
import { esPagado, unlockUser } from "../../../src/lib/funnel.ts";

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

  // Comprador con la transcripción aún bloqueada: re-lanzar el desbloqueo
  // (idempotente) y enseñar la espera con sondeo, nunca el candado.
  const desbloqueando = !!(esPagado(user) && tr.locked);
  if (desbloqueando) void unlockUser(user.id);

  const P = precioPara(locale);
  const precio = P.monthlyLabel;
  const trialDays = Number(process.env.TRIAL_DAYS || 7);
  const todayLabel = P.todayLabel;

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="dash" locale={locale}>
      <a href="/dashboard" className="muted" style={{ fontSize: 14 }}>{ui(locale).back}</a>
      <Resultado tr={tr as any} s={ui(locale)} precio={precio} ctaHref={`/pay?t=${tr.id}`} trialDays={trialDays} todayLabel={todayLabel} desbloqueando={desbloqueando} />
    </AppShell>
  );
}
