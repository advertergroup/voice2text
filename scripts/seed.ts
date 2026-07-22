import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/core.ts";
import { DEFAULT_CONTENT } from "../src/lib/content.ts";

/** Siembra idempotente: crea lo que falte, NO pisa lo que el admin ya editó (update: {}). */
const p = new PrismaClient();

// 1) Admin
const email = (process.env.ADMIN_EMAIL || "admin@voice2text.local").toLowerCase();
const pw = process.env.ADMIN_PASSWORD || "Voice2Text2026!";
await p.user.upsert({
  where: { email },
  update: { role: "ADMIN" },
  create: { email, nombre: "Admin", passwordHash: hashPassword(pw), role: "ADMIN", subStatus: "ACTIVE", planKey: "premium" },
});

// 2) Textos
for (const c of DEFAULT_CONTENT) {
  await p.siteContent.upsert({
    where: { key: c.key },
    update: { label: c.label, grupo: c.grupo, orden: c.orden ?? 0, multiline: !!c.multiline }, // metadatos sí se refrescan; el valor NO
    create: { key: c.key, value: c.value, label: c.label, grupo: c.grupo, orden: c.orden ?? 0, multiline: !!c.multiline },
  });
}

// 3) Planes
const planes = [
  { key: "trial", nombre: "Prueba", precioCent: 50, periodo: "trial", badge: "7 días", botonTexto: "Empezar prueba", orden: 1, destacado: false,
    descripcion: "Prueba 7 días por 0,50 €. Después 39,90 €/mes si no cancelas.",
    caracteristicas: ["Transcripciones de audio y vídeo ilimitadas", "Todos los modos de transcripción", "Exporta a TXT, DOCX, PDF y SRT", "Cancela cuando quieras"] },
  { key: "premium", nombre: "Premium", precioCent: 3990, periodo: "month", badge: "Más popular", botonTexto: "Hazte Premium", orden: 2, destacado: true,
    descripcion: "Todo ilimitado, con soporte prioritario.",
    caracteristicas: ["Transcripciones de audio y vídeo ilimitadas", "Más de 90 idiomas y acentos", "Todos los modos de transcripción", "Exporta a TXT, DOCX, PDF y SRT", "Acceso inmediato y soporte prioritario"] },
];
for (const pl of planes) {
  await p.plan.upsert({ where: { key: pl.key }, update: {}, create: pl });
}

// 4) FAQ
const faqs = [
  { pregunta: "¿Cuánto audio puedo transcribir?", respuesta: "Sin límite. No hay tope de duración total mensual: transcribe todo el audio y vídeo que necesites.", orden: 1 },
  { pregunta: "¿Qué idiomas admite?", respuesta: "Más de 90 idiomas y acentos, incluidos español, inglés, francés, alemán, italiano, portugués, chino, japonés, árabe y ruso.", orden: 2 },
  { pregunta: "¿En qué formatos puedo descargar?", respuesta: "TXT, DOCX, PDF y subtítulos SRT.", orden: 3 },
  { pregunta: "¿Qué archivos puedo subir?", respuesta: "Audio (MP3, WAV, M4A, AAC, OGG, OPUS, WMA) y vídeo (MP4, MOV, MPEG, WMV). También puedes grabar por micrófono o pegar una URL.", orden: 4 },
  { pregunta: "¿Puedo cancelar cuando quiera?", respuesta: "Sí. Al cancelar mantienes el acceso hasta el final de tu periodo de facturación.", orden: 5 },
  { pregunta: "¿Mis archivos están seguros?", respuesta: "Todos los archivos se procesan de forma segura y cifrada. Nunca compartimos tus datos con terceros.", orden: 6 },
];
for (let i = 0; i < faqs.length; i++) {
  const f = faqs[i]!;
  const ex = await p.faqItem.findFirst({ where: { pregunta: f.pregunta } });
  if (!ex) await p.faqItem.create({ data: f });
}

// 5) Landings SEO
const landings = [
  { slug: "transcribir-audio-a-texto", titulo: "Transcribir audio a texto", subtitulo: "Convierte cualquier audio en texto en segundos, con IA y en más de 90 idiomas." },
  { slug: "transcribir-video-a-texto", titulo: "Transcribir vídeo a texto", subtitulo: "Extrae el texto de tus vídeos automáticamente. MP4, MOV y más." },
  { slug: "mp3-a-texto", titulo: "MP3 a texto", subtitulo: "Sube tu MP3 y obtén la transcripción lista para editar y descargar." },
  { slug: "transcribir-videos-de-youtube", titulo: "Transcribir vídeos de YouTube", subtitulo: "Pega el enlace de YouTube y consigue la transcripción completa." },
  { slug: "audio-a-texto-en-espanol", titulo: "Audio a texto en español", subtitulo: "Transcripción de voz a texto en español con gran precisión." },
  { slug: "grabacion-de-voz-a-texto", titulo: "Grabación de voz a texto", subtitulo: "Graba con el micrófono y transcribe al instante." },
];
for (let i = 0; i < landings.length; i++) {
  const l = landings[i]!;
  await p.landingPage.upsert({
    where: { slug: l.slug }, update: {},
    create: { ...l, orden: i, metaDesc: l.subtitulo, cuerpo: `<p>Con <strong>{brand}</strong> puedes ${l.titulo.toLowerCase()} de forma rápida y precisa. Sube tu archivo o pega una URL, elige el modo de transcripción y descarga el resultado en TXT, DOCX, PDF o SRT.</p><p>Sin límites de duración y en más de 90 idiomas. Crea tu cuenta gratis para empezar.</p>` },
  });
}

console.log("✅ Seed completado: admin, textos, planes, FAQ y landings.");
await p.$disconnect();
