import { loadContent, t, getLocale } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { Nav } from "../../src/ui/site.tsx";
import { localePath } from "../../src/lib/locale.ts";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Register({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const c = await loadContent(locale);
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <Nav c={c} locale={locale} />
      <div className="authwrap">
        <h1 style={{ fontSize: 28, textAlign: "center" }}>{t(c, "auth.register.title")}</h1>
        <p className="muted" style={{ textAlign: "center" }}>{t(c, "cta.subtitle")}</p>
        {sp.error === "exists" && <div className="err">{t(c, "auth.login.noAccount")} — <a href={localePath(locale, "/login")}>{t(c, "auth.login.title")}</a></div>}
        {sp.error === "1" && <div className="err">✗</div>}
        <form action="/api/register" method="post" className="card" style={{ marginTop: 18 }}>
          <input type="hidden" name="plan" value={sp.plan || ""} />
          <input type="hidden" name="locale" value={locale} />
          <div className="field"><label>{t(c, "auth.register.name")}</label><input name="nombre" type="text" /></div>
          <div className="field"><label>{t(c, "auth.login.email")}</label><input name="email" type="email" required autoFocus /></div>
          <div className="field"><label>{t(c, "auth.login.password")}</label><input name="password" type="password" minLength={6} required /></div>
          <button className="btn btn-primary" style={{ width: "100%" }}>{t(c, "auth.register.submit")}</button>
        </form>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}><a href={localePath(locale, "/login")} style={{ color: "var(--accent)", fontWeight: 600 }}>{t(c, "auth.register.haveAccount")}</a></p>
      </div>
    </>
  );
}
