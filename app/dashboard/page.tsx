import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { AppShell } from "../../src/ui/AppShell.tsx";
import { Uploader } from "../../src/ui/Uploader.tsx";
import { isLocale, DEFAULT_LOCALE, LANG_COOKIE, localePath } from "../../src/lib/locale.ts";
import { ui, fmt } from "../../src/lib/ui.ts";
import { esPagado, quotaAgotada } from "../../src/lib/funnel.ts";
import { AdsConversion } from "../../src/ui/AdsConversion.tsx";
import { monedaPorLocale, MONTHLY_CENTS } from "../../src/lib/precio.ts";

export const dynamic = "force-dynamic";

// Etiquetas de estado y errores: claves del diccionario de UI (st_* / err_*), nada escrito aquí.
const ESTADO: Record<string, { cls: string; key: string }> = {
  DONE: { cls: "done", key: "st_done" }, PROCESSING: { cls: "proc", key: "st_proc" },
  MANUAL: { cls: "proc", key: "st_manual" },
  QUEUED: { cls: "queued", key: "st_queued" }, ERROR: { cls: "err", key: "st_err" },
};


export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prisma = await getPrisma();
  const items = await prisma.transcription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });


  // Cuota: gratis y prueba de 7 días = 1 transcripción; ilimitadas solo con el plan mensual ACTIVO.
  // El modal de cuota es SOLO para el trial pagado (upsell al mensual); antes de pagar no hay límite.
  const quota = esPagado(user) && user.subStatus !== "ACTIVE" && await quotaAgotada(user.id, null);
  const quotaCtaHref = esPagado(user) ? "/api/account/upgrade" : "/pay"; // TRIAL → pasar al mensual; gratis → checkout
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const locale = isLocale(cookieLang) ? cookieLang! : DEFAULT_LOCALE;
  const s = ui(locale);
  const errMsg = sp.error && ["nofile", "badtype", "toobig", "infected", "limit"].includes(sp.error) ? s["err_" + sp.error] : null;
  const quotaTexts = { title: s.quota_title!, desc: s.quota_desc!, cta: s.quota_cta!, later: s.quota_later! };

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="dash" locale={locale}>
      <h1 style={{ fontSize: 26, marginTop: 0 }}>{s.dash_new}</h1>
      {errMsg && <div className="err" style={{ marginBottom: 16 }}>⚠️ {errMsg}{sp.error === "toobig" && sp.max ? " " + fmt(s.err_max, { max: sp.max }) : ""}</div>}
      {sp.upgraded && <div className="ok" style={{ marginBottom: 16 }}>✓ {s.up_ok}</div>}
      {/* Upgrade al mensual = la conversión valiosa de verdad; txid estable = sin duplicados al recargar. */}
      {sp.upgraded && <AdsConversion value={MONTHLY_CENTS / 100} txid={`up-${user.id}`} currency={monedaPorLocale(locale)} itemId="premium-monthly" itemName="Premium monthly plan" email={user.email} />}
      <div style={{ marginBottom: 30 }}>
        <div className="card" style={{ padding: 24 }}>
          <Uploader dropzoneText={t(c, "hero.dropzone")} selectText={t(c, "hero.selectFiles")} quotaLocked={quota} quotaTexts={quotaTexts} quotaCtaHref={quotaCtaHref}
            s={s} micHref={localePath(locale, "/talk-to-text")} termsHref={localePath(locale, "/terms")} privacyHref={localePath(locale, "/privacy")} />
        </div>
      </div>

      <h2 style={{ fontSize: 20 }}>{s.dash_mine}</h2>
      {items.length === 0 ? (
        <p className="muted">{s.dash_empty}</p>
      ) : (
        <table>
          <thead><tr><th>{s.th_title}</th><th>{s.th_lang}</th><th>{s.th_mode}</th><th>{s.th_status}</th><th>{s.th_date}</th><th></th></tr></thead>
          <tbody>
            {items.map((i: any) => {
              const e = ESTADO[i.status] ?? ESTADO.QUEUED;
              return (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600, maxWidth: 280 }}>{i.titulo}</td>
                  <td>{i.language}</td>
                  <td>{i.mode}</td>
                  <td><span className={"tag " + e.cls}>{s[e.key]}</span></td>
                  <td className="muted">{new Date(i.createdAt).toLocaleDateString(locale)}</td>
                  <td><a href={`/dashboard/${i.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>{s.open}</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
