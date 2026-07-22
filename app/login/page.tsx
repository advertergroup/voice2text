import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { Nav } from "../../src/ui/site.tsx";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <Nav c={c} />
      <div className="authwrap">
        <h1 style={{ fontSize: 28, textAlign: "center" }}>{t(c, "nav.login")}</h1>
        {sp.error && <div className="err">Email o contraseña incorrectos.</div>}
        <form action="/api/login" method="post" className="card" style={{ marginTop: 18 }}>
          <div className="field"><label>Email</label><input name="email" type="email" required autoFocus /></div>
          <div className="field"><label>Contraseña</label><input name="password" type="password" required /></div>
          <button className="btn btn-primary" style={{ width: "100%" }}>{t(c, "nav.login")}</button>
        </form>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>¿No tienes cuenta? <a href="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>{t(c, "nav.register")}</a></p>
      </div>
    </>
  );
}
