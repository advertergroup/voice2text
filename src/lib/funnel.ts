import { rm } from "node:fs/promises";
import { join } from "node:path";
import { getPrisma } from "../db/client.ts";
import { transcribe } from "./transcribe.ts";

/** Parámetros del funnel (configurables por env). */
export const PREVIEW_SECONDS = Number(process.env.PREVIEW_SECONDS || 60);
export const FILE_RETENTION_HOURS = Number(process.env.FILE_RETENTION_HOURS || 36);
export const ANON_UPLOAD_LIMIT = Number(process.env.ANON_UPLOAD_LIMIT || 5); // subidas/hora por sesión anónima
export const ANON_COOKIE = "v2t_anon";

const UPLOAD_DIR = join(process.cwd(), "uploads");

/** ¿El usuario tiene acceso completo (suscripción activa o en prueba)? */
export function esPagado(u: { subStatus?: string | null } | null | undefined): boolean {
  return !!u && (u.subStatus === "ACTIVE" || u.subStatus === "TRIAL");
}

/** Borra los archivos de transcripciones bloqueadas caducadas (no pagadas). Oportunista y barato. */
export async function cleanupExpired(): Promise<void> {
  try {
    const prisma = await getPrisma();
    const caducadas = await prisma.transcription.findMany({
      where: { locked: true, fileDeleted: false, fileExpiresAt: { lt: new Date() }, fileKey: { not: null } },
      select: { id: true, fileKey: true }, take: 50,
    });
    for (const t of caducadas) {
      if (t.fileKey) await rm(join(UPLOAD_DIR, t.fileKey), { force: true }).catch(() => {});
      await prisma.transcription.update({ where: { id: t.id }, data: { fileDeleted: true } }).catch(() => {});
    }
  } catch { /* silencioso */ }
}

/** Al pagar: transcribe el resto (completo) de las transcripciones bloqueadas del usuario que aún tengan archivo. */
export async function unlockUser(userId: string): Promise<void> {
  const prisma = await getPrisma();
  const pend = await prisma.transcription.findMany({
    where: { userId, locked: true, fileDeleted: false, fileKey: { not: null } }, take: 50,
  });
  for (const tr of pend) {
    void (async () => {
      try {
        const path = join(UPLOAD_DIR, tr.fileKey!);
        const r = await transcribe(path, { language: tr.language, mode: tr.mode, originalName: tr.titulo });
        await prisma.transcription.update({
          where: { id: tr.id },
          data: { texto: r.text, segmentos: r.segments as any, duracionSeg: tr.duracionSeg ?? r.durationSec ?? null, locked: false, status: "DONE", fileDeleted: true },
        });
        await rm(path, { force: true }).catch(() => {}); // pagado y completo → borrar
      } catch { /* se queda bloqueada; se puede reintentar */ }
    })();
  }
}
