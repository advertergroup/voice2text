import { spawn } from "node:child_process";

/**
 * Guardia de subidas: valida que lo que se sube es de verdad audio/vídeo (no un ejecutable
 * o script disfrazado), limita el tamaño y ofrece un escaneo antivirus opcional (ClamAV).
 * El servidor NUNCA ejecuta los archivos subidos; esto es defensa en profundidad.
 */

/** Límite de tamaño de subida (MB). Configurable con MAX_UPLOAD_MB (por defecto 500). */
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 500);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Extensiones de audio/vídeo permitidas. */
export const ALLOWED_EXT = new Set([
  ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".oga", ".wma", ".flac",
  ".mp4", ".mov", ".mpeg", ".mpg", ".wmv", ".mkv", ".avi", ".webm", ".m4v", ".3gp",
]);

/**
 * Comprueba los "magic bytes": solo devuelve un tipo si el contenido es un contenedor
 * real de audio/vídeo. Devuelve null para cualquier otra cosa (ejecutables, scripts,
 * documentos, ZIP…), que debe rechazarse.
 */
export function sniffMedia(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  const b = buf;
  const at = (o: number, s: string) => b.toString("latin1", o, o + s.length) === s;

  if (at(0, "ID3")) return "mp3";                                   // MP3 con etiqueta ID3
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return "mpeg-audio"; // sync MP3/AAC (ADTS)
  if (at(0, "RIFF") && at(8, "WAVE")) return "wav";
  if (at(0, "RIFF") && at(8, "AVI ")) return "avi";
  if (at(4, "ftyp")) return "mp4/mov/m4a";                          // ISO-BMFF: mp4/mov/m4a/3gp
  if (at(0, "OggS")) return "ogg/opus";
  if (at(0, "fLaC")) return "flac";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "mkv/webm"; // EBML
  if (b[0] === 0x30 && b[1] === 0x26 && b[2] === 0xb2 && b[3] === 0x75) return "asf/wmv";  // ASF
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 &&
      (b[3] === 0xba || b[3] === 0xb3 || (b[3]! & 0xf0) === 0xe0)) return "mpeg";           // MPEG-PS/ES
  return null;
}

/** Extrae y normaliza la extensión de un nombre de fichero (segura, en minúsculas). */
export function extSegura(nombre: string): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(nombre || "");
  return m ? "." + m[1]!.toLowerCase() : "";
}

/**
 * Escaneo antivirus OPCIONAL con ClamAV. Se activa con CLAMAV_SCAN=1 y requiere `clamdscan`
 * (o el binario en CLAMAV_BIN) instalado. Lanza error si detecta una amenaza.
 * Si está desactivado o el binario no está, no bloquea (los demás controles siguen activos).
 */
export async function scanClamAV(path: string): Promise<void> {
  if (!process.env.CLAMAV_SCAN || process.env.CLAMAV_SCAN === "0") return;
  const bin = process.env.CLAMAV_BIN || "clamdscan";
  const code = await new Promise<number>((res) => {
    const p = spawn(bin, ["--no-summary", "--fdpass", path]);
    p.on("error", () => res(-1)); // binario ausente
    p.on("close", (c) => res(c ?? -1));
  });
  if (code === 1) throw new Error("Archivo rechazado: el antivirus detectó una amenaza.");
  if (code === -1) console.warn("[upload-guard] CLAMAV_SCAN activado pero no se encontró clamdscan; instálalo para escanear.");
}
