import { cookies } from "next/headers";
import { loadContent, t, getLocale } from "../src/lib/content.ts";
import { getCurrentUser } from "../src/auth/session.ts";
import { Nav, Footer } from "../src/ui/site.tsx";
import { Uploader } from "../src/ui/Uploader.tsx";
import { localePath } from "../src/lib/locale.ts";
import { ui } from "../src/lib/ui.ts";
import { ANON_COOKIE, esPagado, quotaAgotada } from "../src/lib/funnel.ts";

export const dynamic = "force-dynamic";

const UPERR: Record<string, string> = {
  nofile: "Sube un archivo o pega una URL.",
  badtype: "Ese archivo no es un audio o vídeo válido (MP3, WAV, M4A, MP4, MOV, MKV…).",
  toobig: "El archivo es demasiado grande.",
  infected: "El archivo se ha rechazado por seguridad.",
  limit: "Has hecho varias pruebas seguidas. Espera un momento e inténtalo de nuevo.",
};

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const reg = user ? "/dashboard" : localePath(locale, "/register");
  const uperr = sp.uperr && sp.uperr !== "quota" ? (UPERR[sp.uperr] || "No se pudo procesar la subida.") : null;

  // Cuota gratuita: si ya usó su transcripción gratis, el uploader abre el aviso del plan al intentar otra.
  const anon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  const quota = !esPagado(user) && await quotaAgotada(user?.id ?? null, anon);
  const s = ui(locale);
  const quotaTexts = { title: s.quota_title!, desc: s.quota_desc!, cta: s.quota_cta!, later: s.quota_later! };

  const feat = [
    ["⚡", "feat.f1"], ["🌍", "feat.f2"], ["📄", "feat.f3"], ["🔒", "feat.f4"],
  ];
  const steps = [["steps.s1"], ["steps.s2"], ["steps.s3"]];
  const modes = [["modes.fast"], ["modes.std"], ["modes.pro"]];

  return (
    <>
      <Nav c={c} user={user} locale={locale} />

      {/* Hero */}
      <div className="hero">
        <div className="container">
          <h1>{t(c, "hero.title")}</h1>
          <p className="sub">{t(c, "hero.subtitle")}</p>
          {uperr && <div className="err" style={{ maxWidth: 560, margin: "0 auto 16px" }}>⚠️ {uperr}</div>}
          <div style={{ maxWidth: 660, margin: "0 auto", textAlign: "left" }}>
            <Uploader dropzoneText={t(c, "hero.dropzone")} selectText={t(c, "hero.selectFiles")} quotaLocked={quota} quotaTexts={quotaTexts} />
          </div>
          <div className="badges" style={{ marginTop: 16, justifyContent: "center", display: "flex" }}><span>{t(c, "hero.formats")}</span></div>
        </div>
      </div>

      {/* 3 pasos */}
      <section>
        <div className="container">
          <h2 className="section-title">{t(c, "steps.title")}</h2>
          <div className="section-sub"></div>
          <div className="grid g3">
            {steps.map(([k], i) => (
              <div className="card" key={k}>
                <div className="step-num">{i + 1}</div>
                <h3>{t(c, `${k}.title`)}</h3>
                <p>{t(c, `${k}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="alt">
        <div className="container">
          <h2 className="section-title">{t(c, "feat.title")}</h2>
          <div className="section-sub"></div>
          <div className="grid g4">
            {feat.map(([ico, k]) => (
              <div className="card" key={k}>
                <div className="ico">{ico}</div>
                <h3>{t(c, `${k}.title`)}</h3>
                <p>{t(c, `${k}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modos */}
      <section>
        <div className="container">
          <h2 className="section-title">{t(c, "modes.title")}</h2>
          <div className="section-sub"></div>
          <div className="grid g3">
            {modes.map(([k]) => (
              <div className="card" key={k}>
                <h3>{t(c, `${k}.title`)}</h3>
                <p>{t(c, `${k}.desc`)}</p>
              </div>
            ))}
          </div>
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
