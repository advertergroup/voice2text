import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";

export const dynamic = "force-dynamic";

export default async function HowTo() {
  const c = await loadContent();
  const user = await getCurrentUser();
  const steps = [["steps.s1"], ["steps.s2"], ["steps.s3"]];
  return (
    <>
      <Nav c={c} user={user} />
      <div className="hero" style={{ paddingBottom: 10 }}>
        <div className="container"><h1 style={{ fontSize: 40 }}>{t(c, "steps.title")}</h1></div>
      </div>
      <section style={{ paddingTop: 20 }}>
        <div className="container">
          <div className="grid g3">
            {steps.map(([k], i) => (
              <div className="card" key={k}>
                <div className="step-num">{i + 1}</div>
                <h3>{t(c, `${k}.title`)}</h3>
                <p>{t(c, `${k}.desc`)}</p>
              </div>
            ))}
          </div>
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
