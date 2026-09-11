import { NextResponse } from "next/server";
import { getPrisma } from "../../../../src/db/client.ts";
import { sendMail } from "../../../../src/lib/mailer.ts";
import { tieneStripe, getStripe } from "../../../../src/lib/stripe.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

const HORA = (d: Date) => d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

/**
 * Avisos ÚNICOS a Daniel (cron del VPS cada 10 min; cada aviso deja una fila
 * Evento tipo=aviso y no se repite):
 *  1. trafico-ads-2 → la campaña sirve con volumen real (YA ENVIADO).
 *  2. primera-venta → la PRIMERA compra. Doble fuente: la tabla Evento
 *     (purchase) y, de respaldo, Stripe directamente — por si la fila de
 *     analítica fallara, la venta se detecta igual.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const prisma = await getPrisma();
  const to = process.env.NOTIFY_EMAIL || "danielalcaiderod90@gmail.com";
  const out: Record<string, unknown> = { ok: true };

  // ---- Aviso 1: tráfico real de Ads (≥6 visitantes con gclid) ----
  const yaTrafico = await prisma.evento.findFirst({ where: { tipo: "aviso", path: "trafico-ads-2" } });
  if (yaTrafico) {
    out.trafico = "ya";
  } else {
    const [s] = await prisma.$queryRawUnsafe<any[]>(
      `select count(*)::int as visitas, count(distinct vid)::int as visitantes, min("createdAt") as primera
         from "Evento" where tipo = 'pageview' and origen = 'ads'`);
    if (s && s.visitantes >= 6) {
      const html = `
        <p><strong>Ahora sí: la campaña de Google Ads está sirviendo con volumen real de EEUU.</strong></p>
        <p>Hasta ahora: <strong>${s.visitas} páginas vistas</strong> de <strong>${s.visitantes} visitante(s)</strong> con clic de anuncio (gclid).<br/>
        Primera visita: ${HORA(new Date(s.primera))} (hora de Madrid).</p>
        <p>Dónde mirarlo: <a href="https://voicetotexts.net/admin/analytics">Analítica</a> · <a href="https://voicetotexts.net/admin/heatmap">Mapa de calor</a> · <a href="https://clarity.microsoft.com">Clarity</a></p>
        <p>Este aviso se envía una sola vez.</p>`;
      const enviado = await sendMail(to, "🚀 Tráfico de Google Ads: la campaña está ACTIVA — Voice2Text", html);
      if (enviado) {
        await prisma.evento.create({ data: { tipo: "aviso", path: "trafico-ads-2", meta: JSON.stringify({ visitas: s.visitas, visitantes: s.visitantes }) } });
        out.trafico = "enviado";
      }
    } else {
      out.trafico = `esperando (${s?.visitantes ?? 0} visitantes)`;
    }
  }

  // ---- Aviso 2: PRIMERA VENTA ----
  const yaVenta = await prisma.evento.findFirst({ where: { tipo: "aviso", path: "primera-venta" } });
  if (yaVenta) {
    out.venta = "ya";
    return NextResponse.json(out);
  }

  let venta: { importe: string; cuando: string; quien: string; fuente: string; atribucion: string } | null = null;

  const ev = await prisma.evento.findFirst({ where: { tipo: "purchase" }, orderBy: { createdAt: "asc" } });
  if (ev) {
    const u = ev.userId ? await prisma.user.findUnique({ where: { id: ev.userId }, select: { email: true, utmCampaign: true, utmTerm: true, utmSource: true } }) : null;
    venta = {
      importe: "$" + ((ev.valorCent || 0) / 100).toFixed(2) + " USD",
      cuando: HORA(ev.createdAt),
      quien: u?.email || "(email pendiente de alta)",
      fuente: ev.origen === "ads" ? "Google Ads (gclid)" : "directo/orgánico",
      atribucion: u?.utmCampaign ? `campaña «${u.utmCampaign}»${u.utmTerm ? ` · keyword «${u.utmTerm}»` : ""}` : (u?.utmSource || "sin utm"),
    };
  } else if (tieneStripe()) {
    // Respaldo: si la analítica no registró la compra, Stripe la delata igual.
    try {
      const stripe = await getStripe();
      const ch = await stripe.charges.list({ limit: 5 });
      // Ignora el cargo de la compra de PRUEBA de Daniel (no reembolsado a
      // propósito): no debe disparar el aviso de «primera venta» real.
      const IGNORAR = ["ch_3UECdaFo7btWBIWk1SoQ6bzM"];
      const c = ch.data.find((x: any) => x.status === "succeeded" && x.paid && !x.refunded && !IGNORAR.includes(x.id));
      if (c) {
        venta = {
          importe: (c.amount / 100).toFixed(2) + " " + c.currency.toUpperCase(),
          cuando: HORA(new Date(c.created * 1000)),
          quien: c.billing_details?.email || c.receipt_email || "(sin email en el cargo)",
          fuente: "detectada en Stripe (la analítica no la registró — revisar)",
          atribucion: "ver en Stripe",
        };
      }
    } catch { /* Stripe caído: se reintenta en el próximo tick */ }
  }

  if (!venta) {
    out.venta = "esperando";
    return NextResponse.json(out);
  }

  const html = `
    <p><strong>🎉 PRIMERA VENTA en voicetotexts.net</strong></p>
    <p><strong>${venta.importe}</strong> · ${venta.cuando} (hora de Madrid)<br/>
    Cliente: ${venta.quien}<br/>
    Origen: ${venta.fuente}<br/>
    Atribución: ${venta.atribucion}</p>
    <p><a href="https://voicetotexts.net/admin/analytics">Analítica</a> · <a href="https://voicetotexts.net/admin/ads">Por campaña/keyword</a> · <a href="https://dashboard.stripe.com/payments">Stripe</a></p>
    <p>Este aviso se envía una sola vez (la primera venta).</p>`;
  const enviado = await sendMail(to, "💰 PRIMERA VENTA — Voice To Text", html);
  if (!enviado) { out.venta = "error_mailer"; return NextResponse.json(out, { status: 500 }); }

  await prisma.evento.create({ data: { tipo: "aviso", path: "primera-venta", meta: JSON.stringify(venta).slice(0, 200) } });
  out.venta = "enviado";
  return NextResponse.json(out);
}
