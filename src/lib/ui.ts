import { UI_TRANSLATIONS } from "./ui.generated.ts";

/** Textos de UI de la página de resultado y del checkout (localizados). Placeholders {today} {price} {n} {x}. */
export type UIStrings = Record<string, string>;

export const UI_ES: UIStrings = {
  proc_title: "Preparando tu transcripción…",
  proc_sub: "Estamos procesando tu audio para que sea preciso.",
  err: "No se pudo transcribir. Prueba con otro archivo o inténtalo de nuevo.",
  missing: "Te faltan {x} de transcripción",
  unlock_title: "Desbloquea la transcripción",
  pitch: "Esto es solo el comienzo. Desbloquea la transcripción completa, edítala y descárgala en TXT, DOCX, PDF y SRT.",
  cta: "Desbloquear ahora — {today}",
  cta_sub: "{today} los primeros {n} días, luego {price}/mes · Cancela cuando quieras.",
  expired: "El archivo original ha caducado y se ha borrado. Tras suscribirte, vuelve a subirlo para completar la transcripción.",
  sec_edit: "Editar", sec_export: "Exportar", sec_more: "Más",
  it_search: "Buscar y reemplazar", it_save: "Guardar cambios",
  it_pdf: "Descargar PDF", it_docx: "Descargar DOCX", it_txt: "Descargar TXT", it_srt: "Descargar SRT",
  it_ts: "Mostrar marcas de tiempo", it_translate: "Traducir", it_share: "Compartir transcripción",
  it_audio: "Descargar audio", it_rename: "Renombrar archivo", it_move: "Mover", it_delete: "Eliminar archivo",
  item_locked: "Desbloquea para usar esta opción",
  pay_today: "A pagar hoy",
  pay_desc: "{n} días de acceso completo. Después {price}/mes. Cancela cuando quieras.",
  email: "Email", loading_pay: "Cargando pago seguro…", processing: "Procesando…",
  legal_pre: "Al continuar aceptas nuestros", legal_terms: "Términos", legal_sub: "Suscripción y reembolsos", legal_privacy: "Privacidad",
  pay_secure: "Pago seguro con Stripe.", email_invalid: "Introduce un email válido.", pay_error: "No se pudo procesar el pago.",
  reupload_title: "Sube tu archivo completo",
  reupload_desc: "Tu suscripción está activa. Como el archivo era grande, súbelo de nuevo (completo) para obtener la transcripción entera.",
  reupload_btn: "Subir archivo completo", uploading: "Subiendo y transcribiendo…",
};

export const UI_EN: UIStrings = {
  proc_title: "Preparing your transcription…",
  proc_sub: "We're processing your audio for accuracy.",
  err: "We couldn't transcribe it. Try another file or try again.",
  missing: "You're missing {x} of transcription",
  unlock_title: "Unlock the transcription",
  pitch: "This is just the beginning. Unlock the full transcription, edit it and download it as TXT, DOCX, PDF and SRT.",
  cta: "Unlock now — {today}",
  cta_sub: "{today} for the first {n} days, then {price}/mo · Cancel anytime.",
  expired: "The original file has expired and been deleted. After subscribing, upload it again to complete the transcription.",
  sec_edit: "Edit", sec_export: "Export", sec_more: "More",
  it_search: "Find and replace", it_save: "Save changes",
  it_pdf: "Download PDF", it_docx: "Download DOCX", it_txt: "Download TXT", it_srt: "Download SRT",
  it_ts: "Show timestamps", it_translate: "Translate", it_share: "Share transcription",
  it_audio: "Download audio", it_rename: "Rename file", it_move: "Move", it_delete: "Delete file",
  item_locked: "Unlock to use this option",
  pay_today: "Due today",
  pay_desc: "{n} days of full access. Then {price}/mo. Cancel anytime.",
  email: "Email", loading_pay: "Loading secure payment…", processing: "Processing…",
  legal_pre: "By continuing you agree to our", legal_terms: "Terms", legal_sub: "Subscription & refunds", legal_privacy: "Privacy",
  pay_secure: "Secure payment with Stripe.", email_invalid: "Enter a valid email.", pay_error: "Payment couldn't be processed.",
  reupload_title: "Upload your full file",
  reupload_desc: "Your subscription is active. Since the file was large, upload it again (in full) to get the complete transcription.",
  reupload_btn: "Upload full file", uploading: "Uploading and transcribing…",
};

/** Devuelve los textos de UI para un idioma (fallback a inglés). */
export function ui(locale: string): UIStrings {
  if (locale === "es") return UI_ES;
  if (locale === "en") return UI_EN;
  return { ...UI_EN, ...(UI_TRANSLATIONS[locale] || {}) };
}
