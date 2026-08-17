import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/core.ts";
import { DEFAULT_CONTENT } from "../src/lib/content.ts";
import { TRANSLATIONS, I18N_PLANS, I18N_FAQS, I18N_LANDINGS } from "../src/lib/translations.generated.ts";
import { LEGAL_TRANSLATIONS } from "../src/lib/translations.legal.ts";
import { LOCALE_CODES, DEFAULT_LOCALE } from "../src/lib/locale.ts";

// Claves legales/empresa: se sincronizan SIEMPRE desde el código (contenido versionado, no editable en admin).
const FORCE_KEYS = new Set([
  "legal.terms.title", "legal.terms.body", "legal.privacy.title", "legal.privacy.body",
  "legal.refund.title", "legal.refund.body", "legal.help.title", "legal.help.body",
  "company.name", "company.address", "contact.email", "footer.copyright", "footer.legal",
]);

/**
 * Siembra idempotente y multi-idioma:
 * - es = idioma base (valores canónicos de DEFAULT_CONTENT / arrays de este fichero).
 * - resto de idiomas = traducciones de translations.generated.ts, con fallback a es.
 * NO pisa lo que el admin ya editó (update: solo metadatos / {}).
 */
const p = new PrismaClient();

// 1) Admin
const email = (process.env.ADMIN_EMAIL || "admin@voice2text.local").toLowerCase();
const pw = process.env.ADMIN_PASSWORD || "Voice2Text2026!";
await p.user.upsert({
  where: { email },
  update: { role: "ADMIN" },
  create: { email, nombre: "Admin", passwordHash: hashPassword(pw), role: "ADMIN", subStatus: "ACTIVE", planKey: "premium" },
});

// 2) Textos (SiteContent) por idioma
for (const locale of LOCALE_CODES) {
  const tr = locale === DEFAULT_LOCALE ? {} : (TRANSLATIONS[locale] || {});
  const lg = locale === DEFAULT_LOCALE ? {} : (LEGAL_TRANSLATIONS[locale] || {});
  for (const c of DEFAULT_CONTENT) {
    const value = locale === DEFAULT_LOCALE ? c.value : (lg[c.key] ?? tr[c.key] ?? c.value);
    const meta = { label: c.label, grupo: c.grupo, orden: c.orden ?? 0, multiline: !!c.multiline };
    await p.siteContent.upsert({
      where: { key_locale: { key: c.key, locale } },
      // Legales/empresa → se reescribe el valor siempre; el resto solo metadatos (respeta ediciones del admin).
      update: FORCE_KEYS.has(c.key) ? { ...meta, value } : meta,
      create: { key: c.key, locale, value, ...meta },
    });
  }
}

// 3) Planes por idioma (precio común, textos traducidos)
const basePlanes = [
  { key: "trial", nombre: "Prueba", precioCent: 50, periodo: "trial", badge: "7 días", botonTexto: "Empezar prueba", orden: 1, destacado: false,
    descripcion: "Prueba 7 días por 0,50 €. Después 39,90 €/mes si no cancelas.",
    caracteristicas: ["Transcripciones de audio y vídeo ilimitadas", "Todos los modos de transcripción", "Exporta a TXT, DOCX, PDF y SRT", "Cancela cuando quieras"] },
  { key: "premium", nombre: "Premium", precioCent: 3990, periodo: "month", badge: "Más popular", botonTexto: "Hazte Premium", orden: 2, destacado: true,
    descripcion: "Todo ilimitado, con soporte prioritario.",
    caracteristicas: ["Transcripciones de audio y vídeo ilimitadas", "Más de 90 idiomas y acentos", "Todos los modos de transcripción", "Exporta a TXT, DOCX, PDF y SRT", "Acceso inmediato y soporte prioritario"] },
];
for (const locale of LOCALE_CODES) {
  for (const pl of basePlanes) {
    const trp = locale === DEFAULT_LOCALE ? null : I18N_PLANS[locale]?.[pl.key];
    await p.plan.upsert({
      where: { key_locale: { key: pl.key, locale } },
      update: {},
      create: {
        key: pl.key, locale,
        nombre: trp?.nombre ?? pl.nombre,
        precioCent: pl.precioCent, periodo: pl.periodo,
        badge: trp?.badge ?? pl.badge,
        botonTexto: trp?.botonTexto ?? pl.botonTexto,
        descripcion: trp?.descripcion ?? pl.descripcion,
        caracteristicas: trp?.caracteristicas ?? pl.caracteristicas,
        destacado: pl.destacado, orden: pl.orden,
      },
    });
  }
}

// 4) FAQ por idioma (idempotente por (locale, orden))
const baseFaqs = [
  { orden: 1, pregunta: "¿Cuánto audio puedo transcribir?", respuesta: "Sin límite. No hay tope de duración total mensual: transcribe todo el audio y vídeo que necesites." },
  { orden: 2, pregunta: "¿Qué idiomas admite?", respuesta: "Más de 90 idiomas y acentos, incluidos español, inglés, francés, alemán, italiano, portugués, chino, japonés, árabe y ruso." },
  { orden: 3, pregunta: "¿En qué formatos puedo descargar?", respuesta: "TXT, DOCX, PDF y subtítulos SRT." },
  { orden: 4, pregunta: "¿Qué archivos puedo subir?", respuesta: "Audio (MP3, WAV, M4A, AAC, OGG, OPUS, WMA) y vídeo (MP4, MOV, MPEG, WMV). También puedes grabar por micrófono o pegar una URL." },
  { orden: 5, pregunta: "¿Puedo cancelar cuando quiera?", respuesta: "Sí. Al cancelar mantienes el acceso hasta el final de tu periodo de facturación." },
  { orden: 6, pregunta: "¿Mis archivos están seguros?", respuesta: "Todos los archivos se procesan de forma segura y cifrada. Nunca compartimos tus datos con terceros." },
];
for (const locale of LOCALE_CODES) {
  for (const fq of baseFaqs) {
    const trf = locale === DEFAULT_LOCALE ? null : I18N_FAQS[locale]?.[String(fq.orden)];
    const ex = await p.faqItem.findFirst({ where: { locale, orden: fq.orden } });
    if (!ex) await p.faqItem.create({ data: { locale, orden: fq.orden, pregunta: trf?.pregunta ?? fq.pregunta, respuesta: trf?.respuesta ?? fq.respuesta } });
  }
}

// 5) Landings SEO por idioma (mismo slug, contenido traducido)
const baseLandings = [
  { slug: "transcribir-audio-a-texto", titulo: "Transcribir audio a texto", subtitulo: "Convierte cualquier audio en texto en segundos, con IA y en más de 90 idiomas." },
  { slug: "transcribir-video-a-texto", titulo: "Transcribir vídeo a texto", subtitulo: "Extrae el texto de tus vídeos automáticamente. MP4, MOV y más." },
  { slug: "mp3-a-texto", titulo: "MP3 a texto", subtitulo: "Sube tu MP3 y obtén la transcripción lista para editar y descargar." },
  { slug: "transcribir-videos-de-youtube", titulo: "Transcribir vídeos de YouTube", subtitulo: "Pega el enlace de YouTube y consigue la transcripción completa." },
  { slug: "audio-a-texto-en-espanol", titulo: "Audio a texto en español", subtitulo: "Transcripción de voz a texto en español con gran precisión." },
  { slug: "grabacion-de-voz-a-texto", titulo: "Grabación de voz a texto", subtitulo: "Graba con el micrófono y transcribe al instante." },
];
const cuerpoEs = (titulo: string) => `<p>Con <strong>{brand}</strong> puedes ${titulo.toLowerCase()} de forma rápida y precisa. Sube tu archivo o pega una URL, elige el modo de transcripción y descarga el resultado en TXT, DOCX, PDF o SRT.</p><p>Sin límites de duración y en más de 90 idiomas. Crea tu cuenta gratis para empezar.</p>`;
for (const locale of LOCALE_CODES) {
  for (let i = 0; i < baseLandings.length; i++) {
    const l = baseLandings[i]!;
    const trl = locale === DEFAULT_LOCALE ? null : I18N_LANDINGS[locale]?.[l.slug];
    await p.landingPage.upsert({
      where: { slug_locale: { slug: l.slug, locale } },
      update: {},
      create: {
        slug: l.slug, locale, orden: i,
        titulo: trl?.titulo ?? l.titulo,
        subtitulo: trl?.subtitulo ?? l.subtitulo,
        cuerpo: trl?.cuerpo ?? cuerpoEs(l.titulo),
        metaDesc: trl?.metaDesc ?? l.subtitulo,
      },
    });
  }
}

console.log(`✅ Seed multi-idioma completado (${LOCALE_CODES.length} idiomas): admin, textos, planes, FAQ y landings.`);
await p.$disconnect();
