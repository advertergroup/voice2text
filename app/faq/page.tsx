import { loadContent, t, getLocale } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";
import { DEFAULT_LOCALE } from "../../src/lib/locale.ts";

export const dynamic = "force-dynamic";

export default async function Faq() {
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const prisma = await getPrisma();
  let items = await prisma.faqItem.findMany({ where: { activo: true, locale }, orderBy: { orden: "asc" } });
  if (items.length === 0 && locale !== DEFAULT_LOCALE) {
    items = await prisma.faqItem.findMany({ where: { activo: true, locale: DEFAULT_LOCALE }, orderBy: { orden: "asc" } });
  }
  return (
    <>
      <Nav c={c} user={user} locale={locale} />
      <div className="hero" style={{ paddingBottom: 10 }}>
        <div className="container"><h1 style={{ fontSize: 40 }}>{t(c, "nav.faq")}</h1></div>
      </div>
      <section style={{ paddingTop: 20 }}>
        <div className="container faq" style={{ maxWidth: 720 }}>
          {items.map((f: any) => (
            <details key={f.id}>
              <summary>{f.pregunta}</summary>
              <p>{f.respuesta}</p>
            </details>
          ))}
        </div>
      </section>
      <Footer c={c} locale={locale} />
    </>
  );
}
