import { cookies } from "next/headers";
import { isLocale, DEFAULT_LOCALE, LANG_COOKIE } from "../../src/lib/locale.ts";
import { ui } from "../../src/lib/ui.ts";

export const dynamic = "force-dynamic";

/**
 * Página de conversión post-pago (la URL que se da a Google Ads como "compra").
 * Solo se llega aquí desde /pay/complete tras un cobro correcto. Redirige sola a la transcripción.
 */
export default async function Thanks({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const locale = isLocale(cookieLang) ? cookieLang! : DEFAULT_LOCALE;
  const s = ui(locale);
  const dest = sp.t ? `/r/${encodeURIComponent(sp.t)}` : "/dashboard";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#f7f8fb,#ffffff)", padding: 16 }}>
      <meta httpEquiv="refresh" content={`4;url=${dest}`} />
      <div className="card" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 46 }}>🎉</div>
        <h1 style={{ fontSize: 26, margin: "12px 0 6px" }}>{s.thanks_title}</h1>
        <p className="muted" style={{ marginBottom: 22 }}>{s.thanks_sub}</p>
        <a href={dest} className="btn btn-primary btn-lg" style={{ width: "100%", display: "block" }}>{s.thanks_btn}</a>
      </div>
    </div>
  );
}
