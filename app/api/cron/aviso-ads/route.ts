import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { sendMail } from "../../../../src/lib/mailer.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Aviso ÚNICO a Daniel cuando llega el primer tráfico real de Google Ads
 * (pageviews con origen=ads, es decir, clics con gclid; la campaña solo
 * apunta a EEUU). Lo llama el cron del VPS cada 10 min; tras enviar deja
 * una fila Evento tipo=aviso y no vuelve a enviar.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const prisma = await getPrisma();

  const ya = await prisma.evento.findFirst({ where: { tipo: "aviso", path: "trafico-ads" } });
  if (ya) return NextResponse.json({ ok: true, ya: true });

  const [s] = await prisma.$queryRawUnsafe<any[]>(
    `select count(*)::int as visitas, count(distinct vid)::int as visitantes,
            min("createdAt") as primera
       from "Evento" where tipo = 'pageview' and origen = 'ads'`);
  if (!s || s.visitantes < 1) return NextResponse.json({ ok: true, esperando: true });

  const primera = new Date(s.primera).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });
  const to = process.env.NOTIFY_EMAIL || "danielalcaiderod90@gmail.com";
  const html = `
    <p><strong>La campaña de Google Ads ya está sirviendo: ha llegado el primer tráfico de EEUU.</strong></p>
    <p>Hasta ahora: <strong>${s.visitas} páginas vistas</strong> de <strong>${s.visitantes} visitante(s)</strong> con clic de anuncio (gclid).<br/>
    Primera visita: ${primera} (hora de Madrid).</p>
    <p>Dónde mirarlo:</p>
    <ol>
      <li><a href="https://voicetotexts.net/admin/analytics">Analítica</a> — funnel y compras</li>
      <li><a href="https://voicetotexts.net/admin/heatmap">Mapa de calor</a> — dónde clican</li>
      <li><a href="https://clarity.microsoft.com">Clarity</a> — grabaciones de sesión</li>
    </ol>
    <p>Este aviso se envía una sola vez.</p>`;
  const enviado = await sendMail(to, "🚀 Tráfico de Google Ads: la campaña está ACTIVA — Voice2Text", html);
  if (!enviado) return NextResponse.json({ ok: false, error: "mailer" }, { status: 500 });

  await prisma.evento.create({ data: { tipo: "aviso", path: "trafico-ads", meta: JSON.stringify({ visitas: s.visitas, visitantes: s.visitantes }) } });
  return NextResponse.json({ ok: true, enviado: true, visitas: s.visitas, visitantes: s.visitantes });
}
