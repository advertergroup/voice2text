import { notFound } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { Nav, Footer } from "../../../src/ui/site.tsx";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const prisma = await getPrisma();
  const lp = await prisma.landingPage.findUnique({ where: { slug } });
  const c = await loadContent();
  const brand = t(c, "brand.name");
  if (!lp) return {};
  return { title: `${lp.titulo} — ${brand}`, description: lp.metaDesc.replaceAll("{brand}", brand) };
}

export default async function Landing({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await loadContent();
  const user = await getCurrentUser();
  const prisma = await getPrisma();
  const lp = await prisma.landingPage.findUnique({ where: { slug } });
  if (!lp || !lp.activo) notFound();
  const brand = t(c, "brand.name");
  const html = (lp.cuerpo as string).replaceAll("{brand}", brand);
  return (
    <>
      <Nav c={c} user={user} />
      <div className="hero">
        <div className="container">
          <h1 style={{ fontSize: 44 }}>{lp.titulo}</h1>
          <p className="sub">{lp.subtitulo}</p>
          <a href={user ? "/dashboard" : "/register"} className="btn btn-primary btn-lg">{t(c, "hero.cta")}</a>
        </div>
      </div>
      <section style={{ paddingTop: 30 }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="muted" style={{ fontSize: 17 }} dangerouslySetInnerHTML={{ __html: html }} />
          <div className="cta-band" style={{ marginTop: 40 }}>
            <h2>{t(c, "cta.title")}</h2>
            <p>{t(c, "cta.subtitle")}</p>
            <a href={user ? "/dashboard" : "/register"} className="btn btn-lg">{t(c, "cta.button")}</a>
          </div>
        </div>
      </section>
      <Footer c={c} />
    </>
  );
}
