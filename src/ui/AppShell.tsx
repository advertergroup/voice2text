import type { ReactNode } from "react";
import { ui } from "../lib/ui.ts";

/** Marco con barra lateral para el panel de usuario y el admin. */
export function AppShell({ brand, email, role, active, children, locale = "es" }:
  { brand: string; email: string; role: string; active: string; children: ReactNode; locale?: string }) {
  const s = ui(locale);
  const link = (href: string, label: string, key: string) =>
    <a href={href} className={active === key ? "active" : ""}>{label}</a>;
  return (
    <div className="app">
      <aside className="side">
        <a href="/" className="logo" style={{ marginBottom: 22, fontSize: 17 }}><span className="mark">🎙️</span>{brand}</a>
        {link("/dashboard", s.side_dash!, "dash")}
        {link("/dashboard?new=1", s.side_new!, "new")}
        {link("/account", s.side_account!, "account")}
        {role === "ADMIN" && link("/admin", s.side_admin!, "admin")}
        <form action="/api/logout" method="post" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ width: "100%", fontSize: 14 }}>{s.logout}</button>
        </form>
        <div className="muted" style={{ fontSize: 12, marginTop: 16, wordBreak: "break-all" }}>{email}</div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
