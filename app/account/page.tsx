import { redirect } from "next/navigation";
import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { AppShell } from "../../src/ui/AppShell.tsx";

export const dynamic = "force-dynamic";

const SUB: Record<string, string> = { NONE: "Sin suscripción", TRIAL: "En prueba", ACTIVE: "Activa", PAST_DUE: "Pago pendiente", CANCELED: "Cancelada" };

export default async function Account() {
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prisma = await getPrisma();
  const nTrans = await prisma.transcription.count({ where: { userId: user.id } });
  const planName = user.planKey ? (await prisma.plan.findFirst({ where: { key: user.planKey, locale: "es" } }))?.nombre : null;

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="account">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Mi cuenta</h1>
      <div className="card" style={{ maxWidth: 520 }}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, fontSize: 15 }}>
          <div className="muted">Email</div><div>{user.email}</div>
          <div className="muted">Nombre</div><div>{user.nombre || "—"}</div>
          <div className="muted">Suscripción</div><div><b>{SUB[user.subStatus] || user.subStatus}</b>{planName ? ` · ${planName}` : ""}</div>
          {user.currentPeriodEnd && <><div className="muted">Renueva/expira</div><div>{new Date(user.currentPeriodEnd).toLocaleDateString("es-ES")}</div></>}
          <div className="muted">Transcripciones</div><div>{nTrans}</div>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          {user.subStatus === "NONE" || user.subStatus === "CANCELED"
            ? <a href="/pricing" className="btn btn-primary">Ver planes</a>
            : <span className="tag done" style={{ padding: "8px 14px" }}>✓ Acceso activo</span>}
        </div>
      </div>
    </AppShell>
  );
}
