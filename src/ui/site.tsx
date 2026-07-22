import { t } from "../lib/content.ts";

type C = Record<string, string>;

export function Nav({ c, user }: { c: C; user?: { email: string; role: string } | null }) {
  return (
    <div className="nav">
      <div className="container nav-in">
        <a href="/" className="logo"><span className="mark">🎙️</span>{t(c, "brand.name")}</a>
        <nav className="nav-links">
          <a href="/how-to">{t(c, "nav.howto")}</a>
          <a href="/pricing">{t(c, "nav.pricing")}</a>
          <a href="/faq">{t(c, "nav.faq")}</a>
        </nav>
        <div className="nav-cta">
          {user ? (
            <a href="/dashboard" className="btn btn-primary">Mi panel</a>
          ) : (
            <>
              <a href="/login" className="muted" style={{ fontWeight: 600 }}>{t(c, "nav.login")}</a>
              <a href="/register" className="btn btn-primary">{t(c, "nav.register")}</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const SEO_LINKS = [
  ["/l/transcribir-audio-a-texto", "Transcribir audio a texto"],
  ["/l/transcribir-video-a-texto", "Transcribir vídeo a texto"],
  ["/l/mp3-a-texto", "MP3 a texto"],
  ["/l/transcribir-videos-de-youtube", "Transcribir YouTube"],
  ["/l/audio-a-texto-en-espanol", "Audio a texto en español"],
  ["/l/grabacion-de-voz-a-texto", "Grabación de voz a texto"],
];

export function Footer({ c }: { c: C }) {
  return (
    <footer>
      <div className="container">
        <div className="foot">
          <div style={{ maxWidth: 320 }}>
            <div className="logo" style={{ marginBottom: 10 }}><span className="mark">🎙️</span>{t(c, "brand.name")}</div>
            <div className="muted" style={{ fontSize: 14 }}>{t(c, "footer.tagline")}</div>
          </div>
          <div className="links" style={{ flexDirection: "column", gap: 10 }}>
            <a href="/help">{t(c, "footer.help")}</a>
            <a href="/terms">{t(c, "footer.terms")}</a>
            <a href="/privacy">{t(c, "footer.privacy")}</a>
            <a href="/pricing">{t(c, "nav.pricing")}</a>
          </div>
        </div>
        <div className="seo-links">
          {SEO_LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </div>
        <div className="cr">{t(c, "footer.copyright")}</div>
      </div>
    </footer>
  );
}
