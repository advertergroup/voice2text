import { t } from "../lib/content.ts";

/**
 * Secciones «3 pasos» y «características» con el nivel visual de la referencia:
 * tarjetas con banda ilustrada (SVG propio, paleta de la marca), chip de paso,
 * iconos de línea y CTA píldora. Las usan la home y todas las landings.
 */

const PASO_LABEL: Record<string, string> = { es: "Paso", en: "Step", pt: "Passo", fr: "Étape", de: "Schritt", it: "Passo", nl: "Stap", pl: "Krok" };

const Hoja = ({ x = 0, y = 0, w = 74, h = 92 }: { x?: number; y?: number; w?: number; h?: number }) => (
  <g transform={`translate(${x},${y})`}>
    <rect width={w} height={h} rx="10" fill="#fff" stroke="#e2e8f0" />
    <path d={`M${w - 26} 0 h16 a10 10 0 0 1 10 10 v16 z`} fill="#eef2ff" />
    {[24, 38, 52, 66].map((ly) => <rect key={ly} x="14" y={ly} width={w - 28 - (ly === 66 ? 18 : 0)} height="6" rx="3" fill="#e8edf5" />)}
  </g>
);

const Badge = ({ cx, cy, children }: { cx: number; cy: number; children: React.ReactNode }) => (
  <g>
    <circle cx={cx} cy={cy} r="26" fill="url(#gviolet)" />
    <circle cx={cx} cy={cy} r="26" fill="none" stroke="#fff" strokeWidth="4" />
    {children}
  </g>
);

function ArtePaso({ n }: { n: 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 220 130" width="200" height="118" aria-hidden>
      <defs>
        <linearGradient id="gviolet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" /><stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {n === 1 && (<>
        <Hoja x={73} y={22} />
        <Badge cx={110} cy={66}>
          <path d="M110 78 v-24 m-9 9 9-9 9 9" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Badge>
      </>)}
      {n === 2 && (<>
        <rect x="46" y="30" width="128" height="76" rx="10" fill="#fff" stroke="#e2e8f0" />
        {[46, 60, 74].map((ly, i) => <rect key={ly} x="60" y={ly} width={100 - i * 26} height="7" rx="3.5" fill="#e8edf5" />)}
        <Badge cx={146} cy={86}>
          <path d="M136 96 l14 -14 m-3 -8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 z" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Badge>
      </>)}
      {n === 3 && (<>
        <Hoja x={38} y={26} w={68} h={84} />
        <Hoja x={116} y={26} w={68} h={84} />
        <rect x="30" y="82" width="40" height="20" rx="5" fill="url(#gviolet)" />
        <text x="50" y="96" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">TXT</text>
        <rect x="152" y="42" width="40" height="20" rx="5" fill="url(#gviolet)" />
        <text x="172" y="56" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">PDF</text>
        <Badge cx={110} cy={68}>
          <path d="M110 56 v24 m-9 -9 9 9 9 -9" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Badge>
      </>)}
    </svg>
  );
}

const ICONOS_FEAT: Record<string, React.ReactNode> = {
  "feat.f1": <path d="M13 3 6 14h5l-1 7 7-11h-5l1-7z" strokeLinejoin="round" />, // rayo
  "feat.f2": <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" /></>, // globo
  "feat.f3": <><path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>, // documento
  "feat.f4": <><rect x="6" y="11" width="12" height="9" rx="2" /><path d="M9 11V8a3 3 0 0 1 6 0v3" /></>, // candado
};

export function Pasos({ c, locale, reg }: { c: Record<string, string>; locale: string; reg: string }) {
  const label = PASO_LABEL[locale] || PASO_LABEL.en;
  return (
    <section>
      <div className="container">
        <h2 className="section-title">{t(c, "steps.title")}</h2>
        <div className="grid g3" style={{ marginTop: 26 }}>
          {(["steps.s1", "steps.s2", "steps.s3"] as const).map((k, i) => (
            <div className="pcard" key={k}>
              <div className="pcard-art"><ArtePaso n={(i + 1) as 1 | 2 | 3} /></div>
              <div className="pcard-body">
                <span className="chip-step">{label} {i + 1}</span>
                <h3>{t(c, `${k}.title`)}</h3>
                <p>{t(c, `${k}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 34 }}>
          <a href={reg} className="btn btn-primary btn-lg btn-pill">{t(c, "cta.button")}</a>
        </div>
      </div>
    </section>
  );
}

export function Caracteristicas({ c }: { c: Record<string, string> }) {
  return (
    <section className="alt">
      <div className="container">
        <h2 className="section-title">{t(c, "feat.title")}</h2>
        <div className="grid g4" style={{ marginTop: 26 }}>
          {(["feat.f1", "feat.f2", "feat.f3", "feat.f4"] as const).map((k) => (
            <div className="card fcard" key={k}>
              <div className="fico">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  {ICONOS_FEAT[k]}
                </svg>
              </div>
              <h3>{t(c, `${k}.title`)}</h3>
              <p>{t(c, `${k}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
