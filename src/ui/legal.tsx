import { loadContent, t } from "../lib/content.ts";
import { getCurrentUser } from "../auth/session.ts";
import { Nav, Footer } from "./site.tsx";

/** Página legal genérica: título + cuerpo HTML, ambos editables en el admin. */
export async function LegalPage({ titleKey, bodyKey, contactKey }: { titleKey: string; bodyKey: string; contactKey?: string }) {
  const c = await loadContent();
  const user = await getCurrentUser();
  return (
    <>
      <Nav c={c} user={user} />
      <div className="hero" style={{ paddingBottom: 10 }}>
        <div className="container"><h1 style={{ fontSize: 38 }}>{t(c, titleKey)}</h1></div>
      </div>
      <section style={{ paddingTop: 20 }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="muted" style={{ fontSize: 16 }} dangerouslySetInnerHTML={{ __html: t(c, bodyKey) }} />
          {contactKey && <p style={{ marginTop: 20 }}><b>Contacto:</b> <a style={{ color: "var(--accent)" }} href={`mailto:${t(c, contactKey)}`}>{t(c, contactKey)}</a></p>}
        </div>
      </section>
      <Footer c={c} />
    </>
  );
}
