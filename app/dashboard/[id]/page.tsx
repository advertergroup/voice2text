import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { Editor } from "../../../src/ui/Editor.tsx";

export const dynamic = "force-dynamic";

export default async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prisma = await getPrisma();
  const tr = await prisma.transcription.findUnique({ where: { id } });
  if (!tr || tr.userId !== user.id) redirect("/dashboard");
  const procesando = tr.status === "PROCESSING" || tr.status === "QUEUED";

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="dash">
      {procesando && <meta httpEquiv="refresh" content="4" />}
      <a href="/dashboard" className="muted" style={{ fontSize: 14 }}>← Volver</a>
      <h1 style={{ fontSize: 24, margin: "8px 0 4px", wordBreak: "break-word" }}>{tr.titulo}</h1>
      <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
        {tr.mode} · {tr.language}{tr.duracionSeg ? ` · ${Math.floor(tr.duracionSeg / 60)}:${String(tr.duracionSeg % 60).padStart(2, "0")}` : ""}
      </div>

      {procesando && <div className="card" style={{ textAlign: "center", padding: 50 }}><div style={{ fontSize: 34 }}>⏳</div><p className="muted">Transcribiendo… esta página se actualiza sola.</p></div>}
      {tr.status === "ERROR" && <div className="err">No se pudo transcribir: {tr.error || "error"}. {process.env.TRANSCRIBE_PROVIDER === "mock" ? "" : "Revisa la configuración del motor de transcripción."}</div>}
      {tr.status === "DONE" && <Editor id={tr.id} initial={tr.texto} />}
    </AppShell>
  );
}
