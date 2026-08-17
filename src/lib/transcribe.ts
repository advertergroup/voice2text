import { spawn } from "node:child_process";
import { readFile, stat, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname, basename } from "node:path";

/**
 * Motor de transcripción con proveedores intercambiables (env TRANSCRIBE_PROVIDER):
 *  - mock   → texto de ejemplo (funciona sin claves; para desarrollo/demo).
 *  - openai → API de OpenAI (Whisper). Necesita OPENAI_API_KEY. (Máx 25 MB por archivo.)
 *  - local  → binario whisper/faster-whisper en el servidor (WHISPER_BIN).
 * Vídeo → se extrae el audio con ffmpeg. URLs → se descargan con yt-dlp.
 */

export interface Segmento { start: number; end: number; text: string }
export interface TranscribeResult { text: string; segments: Segmento[]; durationSec?: number }

const VIDEO_EXT = new Set([".mp4", ".mov", ".mpeg", ".mpg", ".wmv", ".mkv", ".avi", ".webm"]);
const run = (bin: string, args: string[]): Promise<{ code: number; out: string; err: string }> =>
  new Promise((res) => {
    const p = spawn(bin, args);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => res({ code: -1, out, err: String(e) }));
    p.on("close", (code) => res({ code: code ?? -1, out, err }));
  });

/** Duración total en segundos (ffprobe), o null si no se puede leer. */
export async function probeDuration(filePath: string): Promise<number | null> {
  const ffprobe = process.env.FFPROBE_BIN || "ffprobe";
  const r = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
  const d = parseFloat((r.out || "").trim());
  return isFinite(d) && d > 0 ? Math.round(d) : null;
}

/** Extrae los primeros `seconds` segundos como audio mp3 (para la preview). Devuelve ruta + temporal a limpiar. */
export async function extraerPreview(filePath: string, seconds: number): Promise<{ path: string; tmp: string }> {
  const ffmpeg = process.env.FFMPEG_BIN || "ffmpeg";
  const dir = await mkdtemp(join(tmpdir(), "v2t-pv-"));
  const out = join(dir, "preview.mp3");
  const r = await run(ffmpeg, ["-y", "-i", filePath, "-t", String(seconds), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "96k", out]);
  if (r.code !== 0) { await rm(dir, { recursive: true, force: true }).catch(() => {}); throw new Error("No se pudo extraer la preview del audio."); }
  return { path: out, tmp: dir };
}

/** Descarga el audio de una URL (YouTube, etc.) con yt-dlp. Devuelve la ruta y su carpeta temporal (para borrarla). */
export async function descargarDeUrl(url: string): Promise<{ path: string; tmp: string }> {
  const ytdlp = process.env.YTDLP_BIN;
  if (!ytdlp) throw new Error("Falta configurar YTDLP_BIN para transcribir desde URL.");
  if (!/^https?:\/\//i.test(url)) throw new Error("URL no válida.");
  const dir = await mkdtemp(join(tmpdir(), "v2t-url-"));
  const salida = join(dir, "audio.%(ext)s");
  const args = ["-x", "--audio-format", "mp3", "--no-playlist", "--no-warnings", "-o", salida];
  if (process.env.YTDLP_COOKIES) args.push("--cookies", process.env.YTDLP_COOKIES);      // cookies YouTube (Netscape)
  if (process.env.YTDLP_PROXY) args.push("--proxy", process.env.YTDLP_PROXY);              // proxy residencial
  if (process.env.YTDLP_ARGS) args.push(...process.env.YTDLP_ARGS.split(" ").filter(Boolean));
  args.push(url);
  const r = await run(ytdlp, args);
  if (r.code !== 0) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    const bloqueo = /confirm you.?re not a bot|sign in/i.test(r.err || "");
    throw new Error(bloqueo
      ? "Esta plataforma (p. ej. YouTube) está limitando la descarga automática ahora mismo. Descarga el audio/vídeo y súbelo directamente, o usa un enlace directo al archivo."
      : "No pudimos acceder a esa URL. Prueba con un enlace directo al archivo o sube el fichero.");
  }
  const files = await readdir(dir);
  const audio = files.find((f) => /\.(mp3|m4a|wav|opus|ogg)$/i.test(f));
  if (!audio) { await rm(dir, { recursive: true, force: true }).catch(() => {}); throw new Error("No se encontró audio descargado."); }
  return { path: join(dir, audio), tmp: dir };
}

/** Si es vídeo, extrae el audio a mp3 con ffmpeg. Devuelve la ruta y el temporal a limpiar (si lo hubo). */
async function asegurarAudio(filePath: string): Promise<{ path: string; tmp?: string }> {
  if (!VIDEO_EXT.has(extname(filePath).toLowerCase())) return { path: filePath };
  const ffmpeg = process.env.FFMPEG_BIN || "ffmpeg";
  const dir = await mkdtemp(join(tmpdir(), "v2t-a-"));
  const out = join(dir, "audio.mp3");
  const r = await run(ffmpeg, ["-y", "-i", filePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "96k", out]);
  if (r.code !== 0) { await rm(dir, { recursive: true, force: true }).catch(() => {}); throw new Error("No se pudo extraer el audio del vídeo (¿ffmpeg instalado?)."); }
  return { path: out, tmp: dir };
}

export async function transcribe(filePath: string, opts: { language?: string; mode?: string; originalName?: string } = {}): Promise<TranscribeResult> {
  const provider = (process.env.TRANSCRIBE_PROVIDER || "mock").toLowerCase();
  if (provider === "mock") return mock(opts.originalName || basename(filePath));
  const { path: audio, tmp } = await asegurarAudio(filePath);
  try {
    if (provider === "openai") return await openai(audio, opts);
    if (provider === "local") return await local(audio, opts);
    throw new Error(`Proveedor de transcripción desconocido: ${provider}`);
  } finally {
    if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {}); // borra el audio extraído del vídeo
  }
}

// ---- OpenAI (Whisper) ----
async function openai(audio: string, opts: { language?: string }): Promise<TranscribeResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY.");
  const size = (await stat(audio)).size;
  if (size > 25 * 1024 * 1024) throw new Error("El archivo supera 25 MB (límite de la API). Usa un audio más corto o el motor local.");
  const buf = await readFile(audio);
  const fd = new FormData();
  fd.append("file", new Blob([buf]), basename(audio));
  fd.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  fd.append("response_format", "verbose_json");
  if (opts.language && opts.language !== "auto") fd.append("language", opts.language);
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd,
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json() as { text: string; duration?: number; segments?: { start: number; end: number; text: string }[] };
  return { text: j.text ?? "", segments: (j.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })), durationSec: j.duration ? Math.round(j.duration) : undefined };
}

// ---- Local (whisper CLI) ----
async function local(audio: string, opts: { language?: string }): Promise<TranscribeResult> {
  const bin = process.env.WHISPER_BIN;
  if (!bin) throw new Error("Falta WHISPER_BIN.");
  const dir = await mkdtemp(join(tmpdir(), "v2t-w-"));
  const args = [audio, "--output_format", "json", "--output_dir", dir, "--model", process.env.WHISPER_MODEL || "small"];
  if (process.env.WHISPER_DEVICE) args.push("--device", process.env.WHISPER_DEVICE);
  if (process.env.WHISPER_COMPUTE) args.push("--compute_type", process.env.WHISPER_COMPUTE);
  if (process.env.WHISPER_THREADS) args.push("--threads", process.env.WHISPER_THREADS);
  if (opts.language && opts.language !== "auto") args.push("--language", opts.language);
  const r = await run(bin, args);
  if (r.code !== 0) throw new Error(`whisper local falló: ${r.err.slice(0, 200)}`);
  const files = await readdir(dir);
  const jsonF = files.find((f) => f.endsWith(".json"));
  if (!jsonF) throw new Error("whisper local no generó JSON.");
  const j = JSON.parse(await readFile(join(dir, jsonF), "utf8")) as { text: string; segments?: { start: number; end: number; text: string }[] };
  await rm(dir, { recursive: true, force: true }).catch(() => {});
  return { text: j.text ?? "", segments: (j.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })) };
}

// ---- Mock ----
function mock(name: string): TranscribeResult {
  const frases = [
    "Hola, esto es una transcripción de ejemplo generada por Voice2Text.",
    `El archivo "${name}" se ha procesado correctamente.`,
    "Cuando configures un motor real (OpenAI Whisper o un modelo local), aquí verás el texto real de tu audio.",
    "Puedes editar este texto y descargarlo en TXT, DOCX, PDF o como subtítulos SRT.",
  ];
  const segments: Segmento[] = frases.map((f, i) => ({ start: i * 4, end: i * 4 + 4, text: f }));
  return { text: frases.join(" "), segments, durationSec: frases.length * 4 };
}
