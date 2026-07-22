export function AdminTabs({ active }: { active: string }) {
  const tabs = [["/admin", "Textos y marca", "textos"], ["/admin/plans", "Planes/Precios", "plans"], ["/admin/faq", "FAQ", "faq"], ["/admin/landings", "Landings SEO", "landings"]];
  return (
    <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 24, flexWrap: "wrap" }}>
      {tabs.map(([href, label, key]) => (
        <a key={key} href={href} style={{ padding: "10px 16px", fontWeight: 600, fontSize: 15, borderBottom: active === key ? "2px solid var(--accent)" : "2px solid transparent", color: active === key ? "var(--accent)" : "var(--ink2)" }}>{label}</a>
      ))}
    </div>
  );
}
