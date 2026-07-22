import { loadContent, t } from "../src/lib/content.ts";
import { getCurrentUser } from "../src/auth/session.ts";
import { Nav, Footer } from "../src/ui/site.tsx";

export const dynamic = "force-dynamic";

export default async function Home() {
  const c = await loadContent();
  const user = await getCurrentUser();

  const feat = [
    ["⚡", "feat.f1"], ["🌍", "feat.f2"], ["📄", "feat.f3"], ["🔒", "feat.f4"],
  ];
  const steps = [["steps.s1"], ["steps.s2"], ["steps.s3"]];
  const modes = [["modes.fast"], ["modes.std"], ["modes.pro"]];

  return (
    <>
      <Nav c={c} user={user} />

      {/* Hero */}
      <div className="hero">
        <div className="container">
          <h1>{t(c, "hero.title")}</h1>
          <p className="sub">{t(c, "hero.subtitle")}</p>
          <a href={user ? "/dashboard" : "/register"} className="btn btn-primary btn-lg">{t(c, "hero.cta")}</a>

          <a href={user ? "/dashboard" : "/register"} className="dropzone" style={{ display: "block" }}>
            <div className="ico">📤</div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>{t(c, "hero.dropzone")}</div>
            <div style={{ marginTop: 16 }}><span className="btn btn-primary">{t(c, "hero.selectFiles")}</span></div>
            <div className="badges" style={{ marginTop: 18 }}><span>{t(c, "hero.formats")}</span></div>
          </a>
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
            <a href={user ? "/dashboard" : "/register"} className="btn btn-lg">{t(c, "cta.button")}</a>
          </div>
        </div>
      </section>

      <Footer c={c} />
    </>
  );
}
