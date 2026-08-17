import { Editor } from "./Editor.tsx";
import { DEFAULT_LOCALE } from "../lib/locale.ts";

type C = Record<string, string>;
export interface TrView {
  id: string; titulo: string; mode: string; language: string; status: string;
  locked: boolean; preview: string; texto: string; previewSeg: number; duracionSeg: number | null; fileDeleted: boolean;
}

const fmtDur = (s?: number | null) => (!s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/** Vista de una transcripción: procesando / error / preview bloqueada (paywall) / completa (editor). */
export function Resultado({ tr, precio, ctaHref }: { tr: TrView; c?: C; locale?: string; precio?: string; ctaHref: string }) {
  const procesando = tr.status === "PROCESSING" || tr.status === "QUEUED";
  const restante = Math.max(0, (tr.duracionSeg || 0) - (tr.previewSeg || 60));
  const lineas = Math.min(24, Math.max(4, Math.round(restante / 4)));

  return (
    <>
      {procesando && <meta httpEquiv="refresh" content="4" />}
      <h1 style={{ fontSize: 24, margin: "8px 0 4px", wordBreak: "break-word" }}>{tr.titulo}</h1>
      <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
        {tr.mode} · {tr.language}{tr.duracionSeg ? ` · ${fmtDur(tr.duracionSeg)}` : ""}
      </div>

      {procesando && (
        <div className="card" style={{ textAlign: "center", padding: 50 }}>
          <div style={{ fontSize: 34 }}>⏳</div>
          <p className="muted">Transcribiendo el inicio… esta página se actualiza sola.</p>
        </div>
      )}
      {tr.status === "ERROR" && <div className="err">No se pudo transcribir. Prueba con otro archivo o inténtalo de nuevo.</div>}

      {tr.status === "DONE" && !tr.locked && <Editor id={tr.id} initial={tr.texto} />}

      {tr.status === "DONE" && tr.locked && (
        <div>
          <div className="card" style={{ padding: 22, fontSize: 15.5, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{tr.preview}</div>

          {restante > 0 ? (
            <div style={{ position: "relative", marginTop: 14, minHeight: 320 }}>
              <div aria-hidden style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none", padding: "8px 22px" }}>
                {Array.from({ length: lineas }).map((_, i) => (
                  <div key={i} style={{ height: 12, background: "var(--ink2, #8a94a6)", opacity: 0.22, borderRadius: 6, margin: "13px 0", width: `${58 + ((i * 37) % 40)}%` }} />
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20, background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 45%)" }}>
                <div style={{ fontSize: 36 }}>🔒</div>
                <h3 style={{ margin: "10px 0 4px" }}>Te faltan {fmtDur(restante)} de transcripción</h3>
                <p className="muted" style={{ maxWidth: 440, marginBottom: 18 }}>Has visto el comienzo. Desbloquea la transcripción <b>completa</b> y descárgala en TXT, DOCX, PDF y SRT.</p>
                <a href={ctaHref} className="btn btn-primary btn-lg">Desbloquear transcripción completa{precio ? ` · ${precio}` : ""}</a>
                <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Cancela cuando quieras.</p>
              </div>
            </div>
          ) : (
            <div className="cta-band" style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>Desbloquea la descarga</h3>
              <p>Copia y descarga tu transcripción en TXT, DOCX, PDF y SRT.</p>
              <a href={ctaHref} className="btn btn-lg">Desbloquear{precio ? ` · ${precio}` : ""}</a>
            </div>
          )}

          {tr.fileDeleted && (
            <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>⚠️ El archivo original ha caducado y se ha borrado. Tras suscribirte, vuelve a subirlo para completar la transcripción.</p>
          )}
        </div>
      )}
    </>
  );
}
