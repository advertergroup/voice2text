import { getPrisma } from "../db/client.ts";

/**
 * Textos editables del sitio. DEFAULT_CONTENT son los valores por defecto (clon del copy de
 * voice2texts.com, en español); el admin los sobreescribe en la BD (SiteContent). Placeholders:
 * usa {brand} para el nombre de la marca (se resuelve al cargar).
 */
export interface ContentDef { key: string; label: string; grupo: string; value: string; multiline?: boolean; orden?: number }

export const DEFAULT_CONTENT: ContentDef[] = [
  // ---- Marca ----
  { key: "brand.name", grupo: "Marca", label: "Nombre de la marca", value: "Voice2Text", orden: 1 },
  { key: "brand.tagline", grupo: "Marca", label: "Eslogan (bajo el logo/menú)", value: "Audio y vídeo a texto", orden: 2 },
  { key: "seo.title", grupo: "Marca", label: "Título SEO (pestaña)", value: "{brand} — Transcribe audio y vídeo a texto al instante", orden: 3 },
  { key: "seo.description", grupo: "Marca", label: "Meta descripción", value: "Convierte audio y vídeo a texto en segundos con IA. Más de 90 idiomas, sin límites, exporta a TXT, DOCX, PDF y SRT.", multiline: true, orden: 4 },

  // ---- Navegación ----
  { key: "nav.howto", grupo: "Navegación", label: "Menú: cómo funciona", value: "Cómo funciona", orden: 1 },
  { key: "nav.pricing", grupo: "Navegación", label: "Menú: precios", value: "Precios", orden: 2 },
  { key: "nav.faq", grupo: "Navegación", label: "Menú: FAQ", value: "Preguntas frecuentes", orden: 3 },
  { key: "nav.login", grupo: "Navegación", label: "Menú: iniciar sesión", value: "Iniciar sesión", orden: 4 },
  { key: "nav.register", grupo: "Navegación", label: "Menú: registrarse", value: "Registrarse", orden: 5 },

  // ---- Hero ----
  { key: "hero.title", grupo: "Home · Portada", label: "Título principal", value: "Transcribe audio y vídeo al instante", multiline: true, orden: 1 },
  { key: "hero.subtitle", grupo: "Home · Portada", label: "Subtítulo", value: "Con {brand} obtienes transcripciones rápidas y precisas, sin límites de tiempo.", multiline: true, orden: 2 },
  { key: "hero.cta", grupo: "Home · Portada", label: "Botón principal", value: "Empezar a transcribir", orden: 3 },
  { key: "hero.dropzone", grupo: "Home · Portada", label: "Texto de la zona de subida", value: "Arrastra tu audio o vídeo aquí, o pega una URL", multiline: true, orden: 4 },
  { key: "hero.selectFiles", grupo: "Home · Portada", label: "Botón seleccionar archivos", value: "Seleccionar archivos", orden: 5 },
  { key: "hero.formats", grupo: "Home · Portada", label: "Formatos aceptados (pie)", value: "MP3, WAV, M4A, MP4, MOV y más · o pega un enlace", orden: 6 },

  // ---- 3 pasos ----
  { key: "steps.title", grupo: "Home · 3 pasos", label: "Título de sección", value: "Así de fácil, en 3 pasos", orden: 1 },
  { key: "steps.s1.title", grupo: "Home · 3 pasos", label: "Paso 1 · título", value: "Sube tu archivo", orden: 2 },
  { key: "steps.s1.desc", grupo: "Home · 3 pasos", label: "Paso 1 · descripción", value: "Arrastra tu audio o vídeo, o pega la URL. También puedes grabar con el micrófono.", multiline: true, orden: 3 },
  { key: "steps.s2.title", grupo: "Home · 3 pasos", label: "Paso 2 · título", value: "Transcribe", orden: 4 },
  { key: "steps.s2.desc", grupo: "Home · 3 pasos", label: "Paso 2 · descripción", value: "Nuestra IA lo convierte a texto en segundos. Revisa y edita en tiempo real.", multiline: true, orden: 5 },
  { key: "steps.s3.title", grupo: "Home · 3 pasos", label: "Paso 3 · título", value: "Descarga y comparte", orden: 6 },
  { key: "steps.s3.desc", grupo: "Home · 3 pasos", label: "Paso 3 · descripción", value: "Exporta a TXT, DOCX, PDF o crea subtítulos SRT.", multiline: true, orden: 7 },

  // ---- Características ----
  { key: "feat.title", grupo: "Home · Características", label: "Título de sección", value: "Todo lo que necesitas para transcribir", orden: 1 },
  { key: "feat.f1.title", grupo: "Home · Características", label: "Feature 1 · título", value: "Sin límites", orden: 2 },
  { key: "feat.f1.desc", grupo: "Home · Características", label: "Feature 1 · descripción", value: "Audio y vídeo transcritos a texto en segundos, sin límite de duración.", multiline: true, orden: 3 },
  { key: "feat.f2.title", grupo: "Home · Características", label: "Feature 2 · título", value: "Más de 90 idiomas", orden: 4 },
  { key: "feat.f2.desc", grupo: "Home · Características", label: "Feature 2 · descripción", value: "Transcribe en más de 90 idiomas y acentos con gran precisión.", multiline: true, orden: 5 },
  { key: "feat.f3.title", grupo: "Home · Características", label: "Feature 3 · título", value: "Múltiples formatos", orden: 6 },
  { key: "feat.f3.desc", grupo: "Home · Características", label: "Feature 3 · descripción", value: "Descarga tus textos en DOC, PDF y TXT, o genera subtítulos SRT.", multiline: true, orden: 7 },
  { key: "feat.f4.title", grupo: "Home · Características", label: "Feature 4 · título", value: "Privado y seguro", orden: 8 },
  { key: "feat.f4.desc", grupo: "Home · Características", label: "Feature 4 · descripción", value: "Tus archivos se procesan cifrados. Nunca compartimos tus datos con terceros.", multiline: true, orden: 9 },

  // ---- Modos ----
  { key: "modes.title", grupo: "Home · Modos", label: "Título de sección", value: "Elige tu modo de transcripción", orden: 1 },
  { key: "modes.fast.title", grupo: "Home · Modos", label: "Modo Fast · título", value: "⚡ Rápido", orden: 2 },
  { key: "modes.fast.desc", grupo: "Home · Modos", label: "Modo Fast · descripción", value: "Ultrarrápido para tareas ágiles.", orden: 3 },
  { key: "modes.std.title", grupo: "Home · Modos", label: "Modo Standard · título", value: "⚙️ Estándar", orden: 4 },
  { key: "modes.std.desc", grupo: "Home · Modos", label: "Modo Standard · descripción", value: "Equilibrio entre velocidad y precisión.", orden: 5 },
  { key: "modes.pro.title", grupo: "Home · Modos", label: "Modo Pro · título", value: "🧠 Pro", orden: 6 },
  { key: "modes.pro.desc", grupo: "Home · Modos", label: "Modo Pro · descripción", value: "Máxima precisión para tareas complejas.", orden: 7 },

  // ---- CTA final ----
  { key: "cta.title", grupo: "Home · CTA final", label: "Título", value: "Empieza a transcribir gratis hoy", orden: 1 },
  { key: "cta.subtitle", grupo: "Home · CTA final", label: "Subtítulo", value: "Crea una cuenta gratis para descargar tu transcripción.", orden: 2 },
  { key: "cta.button", grupo: "Home · CTA final", label: "Botón", value: "Empezar ahora", orden: 3 },

  // ---- Precios (cabecera) ----
  { key: "pricing.title", grupo: "Precios", label: "Título", value: "Un precio simple, sin sorpresas", orden: 1 },
  { key: "pricing.subtitle", grupo: "Precios", label: "Subtítulo", value: "Transcripciones ilimitadas. Cancela cuando quieras.", multiline: true, orden: 2 },
  { key: "pricing.note", grupo: "Precios", label: "Nota bajo los planes", value: "No hay límite de duración total mensual. Al cancelar mantienes el acceso hasta el final del periodo.", multiline: true, orden: 3 },

  // ---- Footer ----
  { key: "footer.tagline", grupo: "Footer", label: "Descripción del footer", value: "La forma más rápida de convertir tu audio y vídeo en texto.", multiline: true, orden: 1 },
  { key: "footer.help", grupo: "Footer", label: "Enlace: ayuda", value: "Ayuda y soporte", orden: 2 },
  { key: "footer.terms", grupo: "Footer", label: "Enlace: términos", value: "Términos del servicio", orden: 3 },
  { key: "footer.privacy", grupo: "Footer", label: "Enlace: privacidad", value: "Política de privacidad", orden: 4 },
  { key: "footer.copyright", grupo: "Footer", label: "Copyright", value: "© {brand}. Todos los derechos reservados.", orden: 5 },

  // ---- Legales (cuerpo editable) ----
  { key: "legal.terms.title", grupo: "Legales", label: "Términos · título", value: "Términos del servicio", orden: 1 },
  { key: "legal.terms.body", grupo: "Legales", label: "Términos · cuerpo (HTML)", value: "<p>Bienvenido a {brand}. Al usar el servicio aceptas estos términos. Edita este texto en el panel de administración.</p>", multiline: true, orden: 2 },
  { key: "legal.privacy.title", grupo: "Legales", label: "Privacidad · título", value: "Política de privacidad", orden: 3 },
  { key: "legal.privacy.body", grupo: "Legales", label: "Privacidad · cuerpo (HTML)", value: "<p>En {brand} tratamos tus datos con cuidado. Los archivos se procesan cifrados y no se comparten con terceros. Edita este texto en el panel de administración.</p>", multiline: true, orden: 4 },
  { key: "legal.help.title", grupo: "Legales", label: "Ayuda · título", value: "Ayuda y soporte", orden: 5 },
  { key: "legal.help.body", grupo: "Legales", label: "Ayuda · cuerpo (HTML)", value: "<p>¿Necesitas ayuda? Escríbenos y te respondemos lo antes posible. Edita este texto y el email de contacto en el panel de administración.</p>", multiline: true, orden: 6 },
  { key: "contact.email", grupo: "Legales", label: "Email de contacto/soporte", value: "soporte@voice2text.local", orden: 7 },
];

/** Carga todos los textos (defaults + overrides de BD) con los placeholders resueltos. */
export async function loadContent(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const d of DEFAULT_CONTENT) map[d.key] = d.value;
  try {
    const prisma = await getPrisma();
    const rows = await prisma.siteContent.findMany();
    for (const r of rows as { key: string; value: string }[]) map[r.key] = r.value;
  } catch { /* BD no disponible → usa defaults */ }
  const brand = map["brand.name"] || "Voice2Text";
  for (const k of Object.keys(map)) map[k] = (map[k] ?? "").replaceAll("{brand}", brand);
  return map;
}

/** Helper: t(map, "clave") con fallback vacío. */
export const t = (m: Record<string, string>, key: string): string => m[key] ?? "";
