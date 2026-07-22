import type { ReactNode } from "react";

/** Marco con barra lateral para el panel de usuario y el admin. */
export function AppShell({ brand, email, role, active, children }:
  { brand: string; email: string; role: string; active: string; children: ReactNode }) {
  const link = (href: string, label: string, key: string) =>
    <a href={href} className={active === key ? "active" : ""}>{label}</a>;
  return (
    <div className="app">
      <aside className="side">
        <a href="/" className="logo" style={{ marginBottom: 22, fontSize: 17 }}><span className="mark">🎙️</span>{brand}</a>
        {link("/dashboard", "🏠 Mis transcripciones", "dash")}
        {link("/dashboard?new=1", "➕ Nueva", "new")}
        {link("/account", "👤 Mi cuenta", "account")}
        {role === "ADMIN" && link("/admin", "⚙️ Administración", "admin")}
        <form action="/api/logout" method="post" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ width: "100%", fontSize: 14 }}>Cerrar sesión</button>
        </form>
        <div className="muted" style={{ fontSize: 12, marginTop: 16, wordBreak: "break-all" }}>{email}</div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
