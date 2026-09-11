import { Editor } from "./Editor.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import { ReuploadForm } from "./ReuploadForm.tsx";
import { ManualNotice } from "./ManualNotice.tsx";
import { GaEvent } from "./GaEvent.tsx";
import type { UIStrings } from "../lib/ui.ts";

export interface TrView {
  id: string; titulo: string; mode: string; language: string; status: string;
  locked: boolean; preview: string; texto: string; previewSeg: number; duracionSeg: number | null; fileDeleted: boolean; error?: string | null; contactEmail?: string | null;
}

const fmtDur = (s?: number | null) => (!s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const f = (str: string, vars: Record<string, string>) => Object.keys(vars).reduce((a, k) => a.replaceAll(`{${k}}`, vars[k]!), str);

function Sidebar({ ctaHref, s }: { ctaHref: string; s: UIStrings }) {
  const secciones: { titulo: string; items: [string, string][] }[] = [
    { titulo: s.sec_edit!, items: [["🔎", s.it_search!], ["💾", s.it_save!]] },
    { titulo: s.sec_export!, items: [["📄", s.it_pdf!], ["📝", s.it_docx!], ["🗒️", s.it_txt!], ["🎬", s.it_srt!], ["📊", s.it_txt!.replace("TXT", "CSV")]] },
    { titulo: s.sec_more!, items: [["🕒", s.it_ts!], ["🌐", s.it_translate!], ["🔗", s.it_share!], ["⬇️", s.it_audio!], ["✏️", s.it_rename!], ["📁", s.it_move!], ["🗑️", s.it_delete!]] },
  ];
  return (
    <aside className="res-side" style={{ width: 260, flexShrink: 0 }}>
      <div className="card" style={{ padding: 16 }}>
        {secciones.map((sec) => (
          <div key={sec.titulo} style={{ marginBottom: 14 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "4px 6px 6px" }}>{sec.titulo}</div>
            {sec.items.map(([ico, label]) => (
              <a key={label} href={ctaHref} title={s.item_locked}
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
export function Resultado({ tr, precio, ctaHref, trialDays = 7, todayLabel = "", s, desbloqueando = false }: { tr: TrView; s: UIStrings; precio?: string; ctaHref: string; trialDays?: number; todayLabel?: string; desbloqueando?: boolean }) {
  const procesando = tr.status === "PROCESSING" || tr.status === "QUEUED";
  // En el candado, el botón va SIN precio (el importe se ve con todo detalle en
  // el checkout antes de pagar). Se recorta el « — {today}» final en cualquier
  // idioma; si algún día la cadena cambia de forma, cae al texto completo.
  const ctaSinPrecio = (s.cta || "").replace(/\s*[—–-]\s*\{today\}\s*$/, "");
  const restante = Math.max(0, (tr.duracionSeg || 0) - (tr.previewSeg || 25));
  const lineas = Math.min(22, Math.max(5, Math.round(restante / 4)));
  const vars = { today: todayLabel, price: precio || "", n: String(trialDays), x: fmtDur(restante) };

  return (
    <>
      <h1 style={{ fontSize: 24, margin: "8px 0 4px", wordBreak: "break-word" }}>{tr.titulo}</h1>
      <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
        {tr.mode} · {tr.language}{tr.duracionSeg ? ` · ${fmtDur(tr.duracionSeg)}` : ""}
      </div>

      {procesando && <ProgressBar id={tr.id} title={s.proc_title!} sub={s.proc_sub!} />}
      {/* MANUAL (YouTube/Instagram): sin pagar → paywall normal; pagado → aviso de 24h en el panel. */}
      {tr.status === "MANUAL" && !tr.locked && <ManualNotice id={tr.id} s={s} hasEmail={!!tr.contactEmail} />}
      {tr.status === "MANUAL" && tr.locked && (
        <div className="card" style={{ textAlign: "center", padding: 40, maxWidth: 520, margin: "0 auto" }}>
          <div style={{ fontSize: 38 }}>🔒</div>
          <h3 style={{ margin: "12px 0 6px" }}>{s.manual_unlock_title}</h3>
          <p className="muted" style={{ maxWidth: 420, margin: "0 auto 20px" }}>{s.manual_unlock_desc}</p>
          <a href={ctaHref} className="btn btn-primary btn-lg">{f(ctaSinPrecio, vars)}</a>
        </div>
      )}
      {tr.status === "ERROR" && <div className="err">{tr.error || s.err}</div>}

      {tr.status === "DONE" && !tr.locked && (tr.texto ? <Editor id={tr.id} initial={tr.texto} /> : <ReuploadForm id={tr.id} s={s} />)}

      {/* Comprador esperando el desbloqueo en 2º plano: barra que sondea hasta
          locked=false y recarga sola — NUNCA el candado a quien ya ha pagado. */}
      {tr.status === "DONE" && tr.locked && desbloqueando && (
        <ProgressBar id={tr.id} hasta="unlocked" title={s.unlock_wait_title!} sub={s.unlock_wait_sub!} />
      )}

      {tr.status === "DONE" && <GaEvent nombre="preview_viewed" />}
      {tr.status === "DONE" && tr.locked && !desbloqueando && <GaEvent nombre="paywall_viewed" />}

      {tr.status === "DONE" && tr.locked && !desbloqueando && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            {tr.preview && <div className="card" style={{ padding: 22, fontSize: 15.5, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{tr.preview}</div>}

            <div style={{ position: "relative", marginTop: 14, minHeight: 340 }}>
              <div aria-hidden style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none", padding: "8px 4px" }}>
                {Array.from({ length: lineas }).map((_, i) => (
                  <div key={i} style={{ height: 12, background: "var(--ink2, #8a94a6)", opacity: 0.22, borderRadius: 6, margin: "13px 0", width: `${58 + ((i * 37) % 40)}%` }} />
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20, background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 40%)" }}>
                <div style={{ fontSize: 36 }}>🔒</div>
                <h3 style={{ margin: "10px 0 4px" }}>{restante > 0 ? f(s.missing!, vars) : s.unlock_title}</h3>
                <p className="muted" style={{ maxWidth: 440, marginBottom: 18 }}>{s.pitch}</p>
                <a href={ctaHref} className="btn btn-primary btn-lg">{f(ctaSinPrecio, vars)}</a>
              </div>
            </div>

            {tr.fileDeleted && <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>⚠️ {s.expired}</p>}
          </div>

          <Sidebar ctaHref={ctaHref} s={s} />
        </div>
      )}
    </>
  );
}
