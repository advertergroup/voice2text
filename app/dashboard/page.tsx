import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadContent, t } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { getPrisma } from "../../src/db/client.ts";
import { AppShell } from "../../src/ui/AppShell.tsx";
import { Uploader } from "../../src/ui/Uploader.tsx";
import { isLocale, DEFAULT_LOCALE, LANG_COOKIE } from "../../src/lib/locale.ts";
import { ui } from "../../src/lib/ui.ts";
import { esPagado, quotaAgotada } from "../../src/lib/funnel.ts";
import { AdsConversion } from "../../src/ui/AdsConversion.tsx";

export const dynamic = "force-dynamic";

const ESTADO: Record<string, { cls: string; label: string }> = {
  DONE: { cls: "done", label: "Lista" }, PROCESSING: { cls: "proc", label: "Procesando" },
  MANUAL: { cls: "proc", label: "⏳ En proceso · <24h" },
  QUEUED: { cls: "queued", label: "En cola" }, ERROR: { cls: "err", label: "Error" },
};

const ERRORES: Record<string, string> = {
  nofile: "Sube un archivo o pega una URL.",
  badtype: "Ese archivo no es un audio o vídeo válido. Formatos aceptados: MP3, WAV, M4A, AAC, OGG, MP4, MOV, MKV, WEBM…",
  toobig: "El archivo es demasiado grande.",
  infected: "El archivo se ha rechazado por seguridad: el antivirus detectó una amenaza.",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const c = await loadContent();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prisma = await getPrisma();
  const items = await prisma.transcription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });

  const errMsg = sp.error ? ERRORES[sp.error] : null;

  // Cuota: gratis y prueba de 7 días = 1 transcripción; ilimitadas solo con el plan mensual ACTIVO.
  const quota = user.subStatus !== "ACTIVE" && await quotaAgotada(user.id, null);
  const quotaCtaHref = esPagado(user) ? "/api/account/upgrade" : "/pay"; // TRIAL → pasar al mensual; gratis → checkout
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const locale = isLocale(cookieLang) ? cookieLang! : DEFAULT_LOCALE;
  const s = ui(locale);
  const quotaTexts = { title: s.quota_title!, desc: s.quota_desc!, cta: s.quota_cta!, later: s.quota_later! };

  return (
    <AppShell brand={t(c, "brand.name")} email={user.email} role={user.role} active="dash">
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Nueva transcripción</h1>
      {errMsg && <div className="err" style={{ marginBottom: 16 }}>⚠️ {errMsg}{sp.error === "toobig" && sp.max ? ` (máximo ${sp.max} MB)` : ""}</div>}
      {sp.upgraded && <div className="ok" style={{ marginBottom: 16 }}>✓ {s.up_ok}</div>}
      {/* Upgrade al mensual = la conversión valiosa de verdad; txid estable = sin duplicados al recargar. */}
      {sp.upgraded && <AdsConversion value={49.99} txid={`up-${user.id}`} itemId="premium-monthly" itemName="Premium monthly plan" />}
      <div style={{ marginBottom: 30 }}>
        <div className="card" style={{ padding: 24 }}>
          <Uploader dropzoneText={t(c, "hero.dropzone")} selectText={t(c, "hero.selectFiles")} quotaLocked={quota} quotaTexts={quotaTexts} quotaCtaHref={quotaCtaHref} />
        </div>
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
