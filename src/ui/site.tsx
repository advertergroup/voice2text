import { headers } from "next/headers";
import { t } from "../lib/content.ts";
import { LOCALES, localePath, localeInfo, DEFAULT_LOCALE } from "../lib/locale.ts";
import { I18N_LANDINGS } from "../lib/translations.generated.ts";

type C = Record<string, string>;

/** Selector de idioma (server component, sin JS — usa <details>). */
export async function LanguageSwitcher({ locale }: { locale: string }) {
  const h = await headers();
  const path = h.get("x-pathname") || "/";
  const cur = localeInfo(locale);
  return (
    <details className="lang-switch" style={{ position: "relative", display: "inline-block" }}>
      <summary style={{ listStyle: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, fontWeight: 600, fontSize: 14, userSelect: "none" }}>
        <span style={{ fontSize: 16 }}>{cur.flag}</span>
        <span>{cur.code.toUpperCase()}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
      </summary>
      <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "var(--card, #fff)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", padding: 6, minWidth: 170, zIndex: 50 }}>
        {LOCALES.map((l) => (
          <a key={l.code} href={localePath(l.code, path)}
             style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7, fontSize: 14, fontWeight: l.code === locale ? 700 : 500, background: l.code === locale ? "var(--accent-soft, #f1f5ff)" : "transparent", textDecoration: "none" }}>
            <span style={{ fontSize: 17 }}>{l.flag}</span>
            <span>{l.native}</span>
          </a>
        ))}
      </div>
    </details>
  );
}

export function Nav({ c, user, locale = DEFAULT_LOCALE }: { c: C; user?: { email: string; role: string } | null; locale?: string }) {
  const lp = (p: string) => localePath(locale, p);
  return (
    <div className="nav">
      <div className="container nav-in">
        <a href={lp("/")} className="logo"><span className="mark">🎙️</span>{t(c, "brand.name")}</a>
        <nav className="nav-links">
          <a href={lp("/how-to")}>{t(c, "nav.howto")}</a>
          <a href={lp("/pricing")}>{t(c, "nav.pricing")}</a>
          <a href={lp("/faq")}>{t(c, "nav.faq")}</a>
        </nav>
        <div className="nav-cta" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* @ts-expect-error Async Server Component */}
          <LanguageSwitcher locale={locale} />
          {user ? (
            <a href="/dashboard" className="btn btn-primary">Mi panel</a>
          ) : (
            <>
              <a href={lp("/login")} className="muted" style={{ fontWeight: 600 }}>{t(c, "nav.login")}</a>
              <a href={lp("/register")} className="btn btn-primary">{t(c, "nav.register")}</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Landings SEO enlazadas en el footer (slug + etiqueta base en español).
const SEO_LINKS: [string, string][] = [
  ["transcribir-audio-a-texto", "Transcribir audio a texto"],
  ["transcribir-video-a-texto", "Transcribir vídeo a texto"],
  ["mp3-a-texto", "MP3 a texto"],
  ["transcribir-videos-de-youtube", "Transcribir YouTube"],
  ["audio-a-texto-en-espanol", "Audio a texto en español"],
  ["grabacion-de-voz-a-texto", "Grabación de voz a texto"],
];

export function Footer({ c, locale = DEFAULT_LOCALE }: { c: C; locale?: string }) {
  const lp = (p: string) => localePath(locale, p);
  const trLand = locale !== DEFAULT_LOCALE ? (I18N_LANDINGS[locale] || {}) : {};
  return (
    <footer>
      <div className="container">
        <div className="foot">
          <div style={{ maxWidth: 320 }}>
            <div className="logo" style={{ marginBottom: 10 }}><span className="mark">🎙️</span>{t(c, "brand.name")}</div>
            <div className="muted" style={{ fontSize: 14 }}>{t(c, "footer.tagline")}</div>
          </div>
          <div className="links" style={{ flexDirection: "column", gap: 10 }}>
            <a href={lp("/help")}>{t(c, "footer.help")}</a>
            <a href={lp("/terms")}>{t(c, "footer.terms")}</a>
            <a href={lp("/privacy")}>{t(c, "footer.privacy")}</a>
            <a href={lp("/refund")}>{t(c, "footer.legal")}</a>
            <a href={lp("/pricing")}>{t(c, "nav.pricing")}</a>
          </div>
        </div>
        <div className="seo-links">
          {SEO_LINKS.map(([slug, esLabel]) => (
            <a key={slug} href={lp("/l/" + slug)}>{trLand[slug]?.titulo || esLabel}</a>
          ))}
        </div>
        <div className="cr">{t(c, "footer.copyright")}</div>
        {(t(c, "company.name") || t(c, "company.address")) && (
          <div className="muted" style={{ fontSize: 12, marginTop: 6, textAlign: "center", opacity: 0.8 }}>
            {t(c, "company.name")}{t(c, "company.name") && t(c, "company.address") ? " · " : ""}{t(c, "company.address")}
          </div>
        )}
      </div>
    </footer>
  );
}
