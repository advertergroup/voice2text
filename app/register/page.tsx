import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { Nav } from "../../src/ui/site.tsx";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Register({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <Nav c={c} />
      <div className="authwrap">
        <h1 style={{ fontSize: 28, textAlign: "center" }}>{t(c, "nav.register")}</h1>
        <p className="muted" style={{ textAlign: "center" }}>{t(c, "cta.subtitle")}</p>
        {sp.error === "exists" && <div className="err">Ese email ya está registrado. <a href="/login">Inicia sesión</a>.</div>}
        {sp.error === "1" && <div className="err">Revisa los datos e inténtalo de nuevo.</div>}
        <form action="/api/register" method="post" className="card" style={{ marginTop: 18 }}>
          <input type="hidden" name="plan" value={sp.plan || ""} />
          <div className="field"><label>Nombre</label><input name="nombre" type="text" /></div>
          <div className="field"><label>Email</label><input name="email" type="email" required autoFocus /></div>
          <div className="field"><label>Contraseña</label><input name="password" type="password" minLength={6} required /></div>
          <button className="btn btn-primary" style={{ width: "100%" }}>{t(c, "nav.register")}</button>
        </form>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>¿Ya tienes cuenta? <a href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>{t(c, "nav.login")}</a></p>
      </div>
    </>
  );
}
