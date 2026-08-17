import { Editor } from "./Editor.tsx";
import { ProgressBar } from "./ProgressBar.tsx";

type C = Record<string, string>;
export interface TrView {
  id: string; titulo: string; mode: string; language: string; status: string;
  locked: boolean; preview: string; texto: string; previewSeg: number; duracionSeg: number | null; fileDeleted: boolean; error?: string | null;
}

const fmtDur = (s?: number | null) => (!s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

// Opciones del panel lateral (como voice2texts.com). En estado bloqueado, TODAS llevan al checkout.
const SIDEBAR: { titulo: string; items: [string, string][] }[] = [
  { titulo: "Editar", items: [["🔎", "Buscar y reemplazar"], ["💾", "Guardar cambios"]] },
  { titulo: "Exportar", items: [["📄", "Descargar PDF"], ["📝", "Descargar DOCX"], ["🗒️", "Descargar TXT"], ["🎬", "Descargar SRT"]] },
  { titulo: "Más", items: [["🕒", "Mostrar marcas de tiempo"], ["🌐", "Traducir"], ["🔗", "Compartir transcripción"], ["⬇️", "Descargar audio"], ["✏️", "Renombrar archivo"], ["📁", "Mover"], ["🗑️", "Eliminar archivo"]] },
];

function Sidebar({ ctaHref }: { ctaHref: string }) {
  return (
    <aside style={{ width: 260, flexShrink: 0 }}>
      <div className="card" style={{ padding: 16 }}>
        {SIDEBAR.map((sec) => (
          <div key={sec.titulo} style={{ marginBottom: 14 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "4px 6px 6px" }}>{sec.titulo}</div>
            {sec.items.map(([ico, label]) => (
              <a key={label} href={ctaHref} title="Desbloquea para usar esta opción"
                 style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", fontSize: 14, borderRadius: 8, textDecoration: "none" }}>
                <span style={{ width: 20, textAlign: "center" }}>{ico}</span>
                <span style={{ flex: 1 }}>{label}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>🔒</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

/** Vista de una transcripción: procesando / error / preview bloqueada (paywall + sidebar) / completa. */
export function Resultado({ tr, precio, ctaHref, trialDays = 7 }: { tr: TrView; c?: C; locale?: string; precio?: string; ctaHref: string; trialDays?: number }) {
  const procesando = tr.status === "PROCESSING" || tr.status === "QUEUED";
  const restante = Math.max(0, (tr.duracionSeg || 0) - (tr.previewSeg || 25));
  const lineas = Math.min(22, Math.max(5, Math.round(restante / 4)));
  const ctaTexto = trialDays > 0 ? `Empezar ${trialDays} días gratis` : `Desbloquear${precio ? ` · ${precio}/mes` : ""}`;
  const ctaSub = trialDays > 0 ? `Luego ${precio || ""}/mes · Cancela cuando quieras.` : "Cancela cuando quieras.";

  return (
    <>
      <h1 style={{ fontSize: 24, margin: "8px 0 4px", wordBreak: "break-word" }}>{tr.titulo}</h1>
      <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
        {tr.mode} · {tr.language}{tr.duracionSeg ? ` · ${fmtDur(tr.duracionSeg)}` : ""}
      </div>

      {procesando && <ProgressBar id={tr.id} />}
      {tr.status === "ERROR" && <div className="err">{tr.error || "No se pudo transcribir. Prueba con otro archivo o inténtalo de nuevo."}</div>}

      {tr.status === "DONE" && !tr.locked && <Editor id={tr.id} initial={tr.texto} />}

      {tr.status === "DONE" && tr.locked && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Columna principal: preview + resto borroso + paywall */}
          <div style={{ flex: 1, minWidth: 300 }}>
            <div className="card" style={{ padding: 22, fontSize: 15.5, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{tr.preview}</div>

            <div style={{ position: "relative", marginTop: 14, minHeight: 340 }}>
              <div aria-hidden style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none", padding: "8px 4px" }}>
                {Array.from({ length: lineas }).map((_, i) => (
                  <div key={i} style={{ height: 12, background: "var(--ink2, #8a94a6)", opacity: 0.22, borderRadius: 6, margin: "13px 0", width: `${58 + ((i * 37) % 40)}%` }} />
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20, background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 40%)" }}>
                <div style={{ fontSize: 36 }}>🔒</div>
                <h3 style={{ margin: "10px 0 4px" }}>{restante > 0 ? `Te faltan ${fmtDur(restante)} de transcripción` : "Desbloquea la transcripción"}</h3>
                <p className="muted" style={{ maxWidth: 440, marginBottom: 18 }}>Esto es solo el comienzo. Desbloquea la transcripción <b>completa</b>, edítala y descárgala en TXT, DOCX, PDF y SRT.</p>
                <a href={ctaHref} className="btn btn-primary btn-lg">{ctaTexto}</a>
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{ctaSub}</p>
              </div>
            </div>

            {tr.fileDeleted && (
              <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>⚠️ El archivo original ha caducado. Tras suscribirte, vuelve a subirlo para completar la transcripción.</p>
            )}
          </div>

          {/* Panel lateral: todas las opciones → checkout (sin punto de fuga) */}
          <Sidebar ctaHref={ctaHref} />
        </div>
      )}
    </>
  );
}
