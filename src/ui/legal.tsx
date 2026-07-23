import { loadContent, t, getLocale } from "../lib/content.ts";
import { getCurrentUser } from "../auth/session.ts";
import { Nav, Footer } from "./site.tsx";

/** Página legal genérica: título + cuerpo HTML, ambos editables en el admin (por idioma). */
export async function LegalPage({ titleKey, bodyKey, contactKey }: { titleKey: string; bodyKey: string; contactKey?: string }) {
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  return (
    <>
      <Nav c={c} user={user} locale={locale} />
      <div className="hero" style={{ paddingBottom: 10 }}>
        <div className="container"><h1 style={{ fontSize: 38 }}>{t(c, titleKey)}</h1></div>
      </div>
      <section style={{ paddingTop: 20 }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="muted" style={{ fontSize: 16 }} dangerouslySetInnerHTML={{ __html: t(c, bodyKey) }} />
          {contactKey && <p style={{ marginTop: 20 }}><b>{t(c, "footer.help")}:</b> <a style={{ color: "var(--accent)" }} href={`mailto:${t(c, contactKey)}`}>{t(c, contactKey)}</a></p>}
        </div>
      </section>
      <Footer c={c} locale={locale} />
    </>
  );
}
