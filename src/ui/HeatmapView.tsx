"use client";
import { useEffect, useRef, useState } from "react";

/** Mapa de calor: la página real en un iframe (mismo origen) con los clicks superpuestos. */
export function HeatmapView({ url, clicks, vp }: { url: string; clicks: { x: number; y: number }[]; vp: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(0);
  const width = vp === "movil" ? 390 : 1200;

  useEffect(() => {
    setH(0);
    const t = setInterval(() => {
      try {
        const d = ref.current?.contentDocument?.documentElement;
        if (d && d.scrollHeight > 200) setH(d.scrollHeight);
      } catch { /* nada */ }
    }, 600);
    const stop = setTimeout(() => clearInterval(t), 8000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [url]);

  return (
    <div style={{ position: "relative", width, maxWidth: "100%", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      <iframe ref={ref} src={url} width={width} height={h || 900} style={{ border: 0, display: "block", pointerEvents: "none" }} title="Mapa de calor" />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {h > 0 && clicks.map((c, i) => (
          <span key={i} style={{
            position: "absolute", left: `calc(${c.x}% - 10px)`, top: (c.y * h) / 100 - 10, width: 20, height: 20, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,55,0,.5), rgba(255,165,0,.22) 60%, transparent 72%)",
          }} />
        ))}
      </div>
    </div>
  );
}
