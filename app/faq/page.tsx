import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";

export const dynamic = "force-dynamic";

export default async function Faq() {
  const c = await loadContent();
  const user = await getCurrentUser();
  const prisma = await getPrisma();
  const items = await prisma.faqItem.findMany({ where: { activo: true }, orderBy: { orden: "asc" } });
  return (
    <>
      <Nav c={c} user={user} />
      <div className="hero" style={{ paddingBottom: 10 }}>
        <div className="container"><h1 style={{ fontSize: 40 }}>{t(c, "nav.faq")}</h1></div>
      </div>
      <section style={{ paddingTop: 20 }}>
        <div className="container faq" style={{ maxWidth: 720 }}>
          {items.map((f: any) => (
            <details key={f.id}>
              <summary>{f.pregunta}</summary>
              <p>{f.respuesta}</p>
            </details>
          ))}
        </div>
      </section>
      <Footer c={c} />
    </>
  );
}
