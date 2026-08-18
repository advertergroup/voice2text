import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { AppShell } from "../../src/ui/AppShell.tsx";
import { CancelSubButton } from "../../src/ui/CancelSubButton.tsx";
import { formatPrice, isLocale, DEFAULT_LOCALE, LANG_COOKIE } from "../../src/lib/locale.ts";
import { ui } from "../../src/lib/ui.ts";

export const dynamic = "force-dynamic";

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const locale = isLocale(cookieLang) ? cookieLang! : DEFAULT_LOCALE;
  const s = ui(locale);
  const prisma = await getPrisma();
  const nTrans = await prisma.transcription.count({ where: { userId: user.id } });
  const plan = user.planKey ? await prisma.plan.findFirst({ where: { key: user.planKey, locale: "es" } }) : null;

  const ESTADOS: Record<string, string> = {
    NONE: s.acct_status_none!, TRIAL: s.acct_status_trial!, ACTIVE: s.acct_status_active!,
    PAST_DUE: s.acct_status_pastdue!, CANCELED: s.acct_status_canceled!,
  };
  const activa = user.subStatus === "ACTIVE" || user.subStatus === "TRIAL";
  const fecha = user.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleDateString(locale) : null;
  const precioPlan = plan ? `${formatPrice(plan.precioCent, plan.moneda)}/${locale === "es" ? "mes" : "mo"}` : null;

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="account">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>{s.acct_title}</h1>
      {sp.canceled && <div className="ok">✓ {s.acct_cancel_ok}</div>}
      {sp.error === "cancel" && <div className="err">✗ No se pudo cancelar. Escríbenos a {t(c, "contact.email")}.</div>}

      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, fontSize: 15 }}>
          <div className="muted">{s.acct_email}</div><div>{user.email}</div>
          <div className="muted">{s.acct_name}</div><div>{user.nombre || "—"}</div>
          <div className="muted">{s.acct_trans}</div><div>{nTrans}</div>
          <div className="muted">{s.acct_sub}</div>
          <div>
            <b>{ESTADOS[user.subStatus] || user.subStatus}</b>
            {plan ? ` · ${plan.nombre}${precioPlan ? ` (${precioPlan})` : ""}` : ""}
          </div>
          {fecha && activa && !user.cancelAtPeriodEnd && (<><div className="muted">{s.acct_renews}</div><div>{fecha}</div></>)}
          {fecha && user.cancelAtPeriodEnd && (<><div className="muted">{s.acct_ends}</div><div>{fecha}</div></>)}
        </div>

        {user.cancelAtPeriodEnd && activa && fecha && (
          <div className="ok" style={{ marginTop: 18 }}>{(s.acct_canceled_note || "").replace("{date}", fecha)}</div>
        )}

        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {user.subStatus === "TRIAL" && <a href="/api/account/upgrade" className="btn btn-primary">{s.acct_upgrade}</a>}
          {activa && !user.cancelAtPeriodEnd && (
            <CancelSubButton label={s.acct_cancel!} confirmText={s.acct_cancel_confirm!} />
          )}
          {!activa && <a href="/pricing" className="btn btn-primary">{s.acct_see_plans}</a>}
        </div>
      </div>
    </AppShell>
  );
}
