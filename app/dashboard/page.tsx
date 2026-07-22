import { redirect } from "next/navigation";
import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { AppShell } from "../../src/ui/AppShell.tsx";
import { Uploader } from "../../src/ui/Uploader.tsx";

export const dynamic = "force-dynamic";

const ESTADO: Record<string, { cls: string; label: string }> = {
  DONE: { cls: "done", label: "Lista" }, PROCESSING: { cls: "proc", label: "Procesando" },
  QUEUED: { cls: "queued", label: "En cola" }, ERROR: { cls: "err", label: "Error" },
};

export default async function Dashboard() {
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prisma = await getPrisma();
  const items = await prisma.transcription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="dash">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Nueva transcripción</h1>
      <div className="card" style={{ padding: 24, marginBottom: 30 }}>
        <Uploader dropzoneText={t(c, "hero.dropzone")} selectText={t(c, "hero.selectFiles")} />
      </div>

      <h2 style={{ fontSize: 20 }}>Mis transcripciones</h2>
      {items.length === 0 ? (
        <p className="muted">Aún no tienes transcripciones. Sube tu primer audio o vídeo arriba.</p>
      ) : (
        <table>
          <thead><tr><th>Título</th><th>Idioma</th><th>Modo</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            {items.map((i: any) => {
              const e = ESTADO[i.status] ?? ESTADO.QUEUED;
              return (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600, maxWidth: 280 }}>{i.titulo}</td>
                  <td>{i.language}</td>
                  <td>{i.mode}</td>
                  <td><span className={"tag " + e.cls}>{e.label}</span></td>
                  <td className="muted">{new Date(i.createdAt).toLocaleDateString("es-ES")}</td>
                  <td><a href={`/dashboard/${i.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>Abrir →</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
