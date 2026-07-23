import { loadContent, t, getLocale } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { Nav } from "../../src/ui/site.tsx";
import { localePath } from "../../src/lib/locale.ts";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const c = await loadContent(locale);
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <Nav c={c} locale={locale} />
      <div className="authwrap">
        <h1 style={{ fontSize: 28, textAlign: "center" }}>{t(c, "auth.login.title")}</h1>
        {sp.error && <div className="err">{t(c, "auth.login.email")} / {t(c, "auth.login.password")} ✗</div>}
        <form action="/api/login" method="post" className="card" style={{ marginTop: 18 }}>
          <div className="field"><label>{t(c, "auth.login.email")}</label><input name="email" type="email" required autoFocus /></div>
          <div className="field"><label>{t(c, "auth.login.password")}</label><input name="password" type="password" required /></div>
          <button className="btn btn-primary" style={{ width: "100%" }}>{t(c, "auth.login.submit")}</button>
        </form>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}><a href={localePath(locale, "/register")} style={{ color: "var(--accent)", fontWeight: 600 }}>{t(c, "auth.login.noAccount")}</a></p>
      </div>
    </>
  );
}
