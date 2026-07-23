import { notFound } from "next/navigation";
import { loadContent, t, getLocale } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { Nav, Footer } from "../../../src/ui/site.tsx";
import { localePath, DEFAULT_LOCALE } from "../../../src/lib/locale.ts";

export const dynamic = "force-dynamic";

// Busca la landing en el idioma pedido; si no existe, cae al idioma base (mismo slug).
async function findLanding(slug: string, locale: string) {
  const prisma = await getPrisma();
  let lp = await prisma.landingPage.findUnique({ where: { slug_locale: { slug, locale } } });
  if (!lp && locale !== DEFAULT_LOCALE) {
    lp = await prisma.landingPage.findUnique({ where: { slug_locale: { slug, locale: DEFAULT_LOCALE } } });
  }
  return lp;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const lp = await findLanding(slug, locale);
  const c = await loadContent(locale);
  const brand = t(c, "brand.name");
  if (!lp) return {};
  return { title: `${lp.titulo} — ${brand}`, description: lp.metaDesc.replaceAll("{brand}", brand) };
}

export default async function Landing({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const lp = await findLanding(slug, locale);
  if (!lp || !lp.activo) notFound();
  const brand = t(c, "brand.name");
  const html = (lp.cuerpo as string).replaceAll("{brand}", brand);
  const reg = user ? "/dashboard" : localePath(locale, "/register");
  return (
    <>
      <Nav c={c} user={user} locale={locale} />
      <div className="hero">
        <div className="container">
          <h1 style={{ fontSize: 44 }}>{lp.titulo}</h1>
          <p className="sub">{lp.subtitulo}</p>
          <a href={reg} className="btn btn-primary btn-lg">{t(c, "hero.cta")}</a>
        </div>
      </div>
      <section style={{ paddingTop: 30 }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="muted" style={{ fontSize: 17 }} dangerouslySetInnerHTML={{ __html: html }} />
          <div className="cta-band" style={{ marginTop: 40 }}>
            <h2>{t(c, "cta.title")}</h2>
            <p>{t(c, "cta.subtitle")}</p>
            <a href={reg} className="btn btn-lg">{t(c, "cta.button")}</a>
          </div>
        </div>
      </section>
      <Footer c={c} locale={locale} />
    </>
  );
}
