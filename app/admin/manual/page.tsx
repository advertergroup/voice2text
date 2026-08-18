import { redirect } from "next/navigation";
import { loadContent, t } from "../../../src/lib/content.ts";
import { getCurrentUser } from "../../../src/auth/session.ts";
import { getPrisma } from "../../../src/db/client.ts";
import { AppShell } from "../../../src/ui/AppShell.tsx";
import { AdminTabs } from "../../../src/ui/AdminTabs.tsx";
import { ManualUpload } from "../../../src/ui/ManualUpload.tsx";

export const dynamic = "force-dynamic";

export default async function AdminManual({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const prisma = await getPrisma();
  const pendientes = await prisma.transcription.findMany({
    where: { status: "MANUAL" },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { user: { select: { email: true, subStatus: true } } },
  });

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="admin">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Administración</h1>
      <AdminTabs active="manual" />
      {sp.done && <div className="ok">✓ Archivo subido; se está transcribiendo. El usuario lo verá en su página en unos minutos.</div>}
      <p className="muted" style={{ fontSize: 14 }}>
        URLs que no se pudieron descargar automáticamente (YouTube/Instagram…). Dos formas de completarlas:
        <br/>• <b>Audio/vídeo</b> descargado de la URL → se transcribe con Whisper.
        <br/>• <b>Transcripción ya hecha</b> (<code>.txt</code>, <code>.srt</code> o <code>.vtt</code>, p. ej. los subtítulos de YouTube) → se usa directamente, sin gastar CPU.
        <br/>En ambos casos el usuario la ve con preview + candado si no ha pagado (completa si es de pago).
      </p>

      {pendientes.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 30 }}>✅</div>
          <p className="muted">No hay transcripciones pendientes de procesado manual.</p>
        </div>
      ) : (
        pendientes.map((p: any) => (
          <div className="card" key={p.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 260, flex: 1 }}>
                <div style={{ fontWeight: 700, wordBreak: "break-all" }}>
                  {p.sourceUrl ? <a href={p.sourceUrl} target="_blank" style={{ color: "var(--accent)" }}>{p.sourceUrl}</a> : p.titulo}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {new Date(p.createdAt).toLocaleString("es-ES")} · idioma: {p.language} ·
                  {p.user ? ` usuario: ${p.user.email} (${p.user.subStatus})` : " anónimo"} ·
                  {p.contactEmail ? ` avisar a: ${p.contactEmail}` : " sin email de aviso"}
                </div>
              </div>
              <ManualUpload id={p.id} />
            </div>
          </div>
        ))
      )}
    </AppShell>
  );
}
