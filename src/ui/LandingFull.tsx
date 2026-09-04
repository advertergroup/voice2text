import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { loadContent, t, getLocale } from "../lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../db/client.ts";
import { Nav, Footer } from "./site.tsx";
import { Uploader } from "./Uploader.tsx";
import { localePath, DEFAULT_LOCALE } from "../lib/locale.ts";
import { ui } from "../lib/ui.ts";
import { ANON_COOKIE, esPagado, quotaAgotada } from "../lib/funnel.ts";
import { Pasos, Caracteristicas, Modos } from "./Secciones.tsx";

/**
 * Plantilla COMPLETA de landing (calco funcional de la home): hero con el
 * uploader real (el visitante entra al funnel desde la propia landing, sin
 * desvío a /register), 3 pasos, características, modos, cuerpo SEO del ángulo
 * y CTA. La usan /l/[slug] y las rutas espejo (/free/transcription, …).
 */

export async function findLanding(slug: string, locale: string) {
  const prisma = await getPrisma();
  let lp = await prisma.landingPage.findUnique({ where: { slug_locale: { slug, locale } } });
  if (!lp && locale !== DEFAULT_LOCALE) {
    lp = await prisma.landingPage.findUnique({ where: { slug_locale: { slug, locale: DEFAULT_LOCALE } } });
  }
  if (!lp && locale !== "en") {
    // Landings de campaña en inglés sin versión en el idioma pedido → EN.
    lp = await prisma.landingPage.findUnique({ where: { slug_locale: { slug, locale: "en" } } });
  }
  return lp;
}

export async function landingMetadata(slug: string) {
  const locale = await getLocale();
  const lp = await findLanding(slug, locale);
  if (!lp) return {};
  const c = await loadContent(locale);
  const brand = t(c, "brand.name");
  return { title: `${lp.titulo} — ${brand}`, description: lp.metaDesc.replaceAll("{brand}", brand) };
}

export async function LandingFull({ slug }: { slug: string }) {
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const lp = await findLanding(slug, locale);
  if (!lp || !lp.activo) notFound();

  const brand = t(c, "brand.name");
  const html = (lp.cuerpo as string).replaceAll("{brand}", brand);
  const reg = user ? "/dashboard" : localePath(locale, "/register");

  const anon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  const quota = user?.subStatus !== "ACTIVE" && await quotaAgotada(user?.id ?? null, anon);
  const quotaCtaHref = esPagado(user) ? "/api/account/upgrade" : "/pay";
  const s = ui(locale);
  const quotaTexts = { title: s.quota_title!, desc: s.quota_desc!, cta: s.quota_cta!, later: s.quota_later! };


  return (
    <>
      <Nav c={c} user={user} locale={locale} />

      {/* Hero del ángulo, con el uploader REAL */}
      <div className="hero">
        <div className="container">
          <h1 style={{ fontSize: 44 }}>{lp.titulo}</h1>
          <p className="sub">{lp.subtitulo.replaceAll("{brand}", brand)}</p>
          <div style={{ maxWidth: 660, margin: "0 auto", textAlign: "left" }}>
            <Uploader dropzoneText={t(c, "hero.dropzone")} selectText={t(c, "hero.selectFiles")} quotaLocked={quota} quotaTexts={quotaTexts} quotaCtaHref={quotaCtaHref} />
          </div>
          <div className="badges" style={{ marginTop: 16, justifyContent: "center", display: "flex" }}><span>{t(c, "hero.formats")}</span></div>
        </div>
      </div>

      {/* 3 pasos + características (rediseño con ilustraciones) */}
      <Pasos c={c} locale={locale} reg={reg} />
      <Caracteristicas c={c} />

      {/* Modos */}
      <Modos c={c} />

      {/* Cuerpo SEO del ángulo (incluye su FAQ) */}
      <section className="alt">
        <div className="container" style={{ maxWidth: 780 }}>
          <div className="landing-body" style={{ fontSize: 16.5, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </section>

      {/* CTA final */}
      <section>
        <div className="container">
          <div className="cta-band">
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
