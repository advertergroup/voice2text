import { getPrisma } from "../db/client.ts";
import { DEFAULT_LOCALE, isLocale } from "./locale.ts";
import { TRANSLATIONS } from "./translations.generated.ts";
import { LEGAL_TRANSLATIONS } from "./translations.legal.ts";

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
  { key: "footer.copyright", grupo: "Footer", label: "Copyright", value: "© {brand} — un producto de {company}. Todos los derechos reservados.", orden: 5 },
  { key: "footer.legal", grupo: "Footer", label: "Enlace: reembolsos", value: "Reembolsos y cancelación", orden: 6 },

  // ---- Empresa (identidad legal) ----
  { key: "company.name", grupo: "Empresa", label: "Razón social", value: "1mmObj LLC", orden: 1 },
  { key: "company.address", grupo: "Empresa", label: "Dirección legal", value: "1209 Mountain Road Pl NE, Ste N, Albuquerque, NM 87110, USA", orden: 2 },
  { key: "contact.email", grupo: "Empresa", label: "Email de contacto/soporte", value: "support@voicetotexts.net", orden: 3 },

  // ---- Legales (cuerpo editable · HTML) ----
  { key: "legal.terms.title", grupo: "Legales", label: "Términos · título", value: "Términos del servicio", orden: 1 },
  { key: "legal.terms.body", grupo: "Legales", label: "Términos · cuerpo (HTML)", multiline: true, orden: 2, value: "<p><em>Última actualización: 4 de agosto de 2026.</em></p><p>Estos Términos del Servicio («Términos») regulan el uso de {brand} («el Servicio»), operado por {company}, con domicilio en {address}. Al crear una cuenta o usar el Servicio, aceptas estos Términos.</p><h2>1. El servicio</h2><p>{brand} transcribe archivos de audio y vídeo a texto mediante inteligencia artificial y permite exportar el resultado en distintos formatos. El Servicio se ofrece «tal cual» y podemos modificar o mejorar sus funciones en cualquier momento.</p><h2>2. Cuenta</h2><p>Debes facilitar información veraz y mantener la confidencialidad de tus credenciales. Eres responsable de la actividad de tu cuenta y debes tener la edad legal en tu jurisdicción para usar el Servicio.</p><h2>3. Planes, precios y facturación</h2><p>El Servicio se ofrece por suscripción. Los precios y la periodicidad se muestran en la página de <a href='/pricing'>Precios</a> y antes de pagar. Salvo indicación en contrario, las suscripciones se <strong>renuevan automáticamente</strong> al final de cada periodo al precio vigente hasta que las canceles. Los pagos se procesan de forma segura a través de nuestro proveedor de pagos; no almacenamos los datos completos de tu tarjeta. Los importes se expresan en euros (EUR) e incluyen los impuestos aplicables cuando corresponda.</p><h2>4. Cancelación y reembolsos</h2><p>Puedes cancelar en cualquier momento; la cancelación detiene las renovaciones futuras y conservas el acceso hasta el final del periodo ya pagado. Consulta nuestra <a href='/refund'>Política de reembolsos y cancelación</a>.</p><h2>5. Uso aceptable</h2><p>Declaras que tienes los derechos necesarios sobre los archivos que subes y que su transcripción no infringe la ley ni derechos de terceros. No puedes usar el Servicio para contenido ilegal, difamatorio o que vulnere la propiedad intelectual o la privacidad de terceros. Podemos suspender cuentas que incumplan estos Términos.</p><h2>6. Tu contenido</h2><p>Conservas la titularidad de los archivos que subes y de las transcripciones que generas. Nos concedes únicamente la licencia técnica necesaria para procesar tus archivos y prestarte el Servicio. Los archivos de audio y vídeo se eliminan automáticamente tras la transcripción (ver <a href='/privacy'>Política de privacidad</a>).</p><h2>7. Propiedad intelectual</h2><p>El software, la marca y el diseño de {brand} son propiedad de {company} y están protegidos por la ley. No se te concede ningún derecho sobre ellos salvo el uso del Servicio conforme a estos Términos.</p><h2>8. Disponibilidad y garantías</h2><p>Nos esforzamos por ofrecer un servicio fiable, pero no garantizamos disponibilidad ininterrumpida ni una exactitud del 100 % en las transcripciones automáticas. El Servicio se presta «tal cual» y «según disponibilidad».</p><h2>9. Limitación de responsabilidad</h2><p>En la medida permitida por la ley, {company} no será responsable de daños indirectos, incidentales o consecuentes derivados del uso del Servicio. Nuestra responsabilidad total se limita al importe abonado por ti en los tres meses anteriores al hecho que motive la reclamación.</p><h2>10. Ley aplicable</h2><p>Estos Términos se rigen por las leyes del Estado de Nuevo México (EE. UU.), sin perjuicio de los derechos que te correspondan como consumidor en tu país de residencia.</p><h2>11. Contacto</h2><p>{company} · {address} · <a href='mailto:{email}'>{email}</a></p>" },
  { key: "legal.privacy.title", grupo: "Legales", label: "Privacidad · título", value: "Política de privacidad", orden: 3 },
  { key: "legal.privacy.body", grupo: "Legales", label: "Privacidad · cuerpo (HTML)", multiline: true, orden: 4, value: "<p><em>Última actualización: 4 de agosto de 2026.</em></p><p>En {brand}, operado por {company} ({address}), respetamos tu privacidad. Esta política explica qué datos tratamos, con qué fin y qué derechos tienes.</p><h2>1. Responsable del tratamiento</h2><p>{company}, {address}. Contacto: <a href='mailto:{email}'>{email}</a>.</p><h2>2. Datos que tratamos</h2><ul><li><strong>Cuenta:</strong> email, nombre y contraseña (almacenada cifrada).</li><li><strong>Archivos:</strong> el audio o vídeo que subes para transcribir y el texto resultante.</li><li><strong>Pago:</strong> gestionado por nuestro proveedor de pagos; recibimos el estado de la suscripción, no los datos completos de tu tarjeta.</li><li><strong>Datos técnicos:</strong> registros de uso, dirección IP y cookies necesarias para el funcionamiento.</li></ul><h2>3. Para qué usamos tus datos</h2><p>Para prestar el Servicio (transcribir tus archivos, gestionar tu cuenta y suscripción), darte soporte, cumplir obligaciones legales y mejorar el Servicio. <strong>No vendemos tus datos.</strong></p><h2>4. Tus archivos de audio y vídeo</h2><p>Tus archivos se procesan con el único fin de generar la transcripción y <strong>se eliminan automáticamente de nuestros servidores en cuanto esta finaliza</strong>. No los usamos para entrenar modelos ni con fines publicitarios.</p><h2>5. Terceros que nos prestan servicio</h2><p>Recurrimos a proveedores que actúan por cuenta nuestra y bajo obligaciones de confidencialidad: un proveedor de transcripción por IA, un proveedor de pagos y un proveedor de alojamiento. Solo acceden a los datos necesarios para su función.</p><h2>6. Cookies</h2><p>Usamos cookies técnicas necesarias para iniciar sesión y recordar tu idioma. No usamos cookies publicitarias de terceros.</p><h2>7. Conservación</h2><p>Conservamos los datos de tu cuenta mientras esté activa y durante el tiempo que exijan las obligaciones legales. Los archivos subidos se eliminan tras la transcripción.</p><h2>8. Tus derechos</h2><p>Puedes acceder, rectificar, suprimir o portar tus datos, y oponerte o limitar su tratamiento, escribiendo a <a href='mailto:{email}'>{email}</a>. Si resides en la UE (RGPD) o en California (CCPA) dispones de derechos adicionales, incluida la reclamación ante tu autoridad de control.</p><h2>9. Seguridad</h2><p>Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito, contraseñas cifradas, acceso restringido) para proteger tus datos.</p><h2>10. Transferencias internacionales</h2><p>Nuestros proveedores pueden tratar datos fuera de tu país. En esos casos aplicamos las salvaguardas adecuadas conforme a la legislación aplicable.</p><h2>11. Menores</h2><p>El Servicio no está dirigido a menores de la edad legal en su jurisdicción y no recopilamos conscientemente sus datos.</p><h2>12. Cambios</h2><p>Podemos actualizar esta política; publicaremos la versión vigente en esta página con su fecha.</p><h2>13. Contacto</h2><p>{company} · {address} · <a href='mailto:{email}'>{email}</a></p>" },
  { key: "legal.refund.title", grupo: "Legales", label: "Reembolsos · título", value: "Política de reembolsos y cancelación", orden: 5 },
  { key: "legal.refund.body", grupo: "Legales", label: "Reembolsos · cuerpo (HTML)", multiline: true, orden: 6, value: "<p><em>Última actualización: 4 de agosto de 2026.</em></p><p>Esta política explica cómo funcionan las cancelaciones y los reembolsos de las suscripciones de {brand}, operado por {company}.</p><h2>1. Cancelación</h2><p>Puedes cancelar tu suscripción en cualquier momento desde tu cuenta o escribiéndonos a <a href='mailto:{email}'>{email}</a>. La cancelación detiene las renovaciones futuras; conservas el acceso hasta el final del periodo ya pagado y no se te volverá a cobrar.</p><h2>2. Renovación automática</h2><p>Las suscripciones se renuevan automáticamente al final de cada periodo, al precio vigente, hasta que canceles. El importe y la periodicidad se muestran claramente antes de pagar.</p><h2>3. Reembolsos</h2><p>Los periodos ya facturados no son reembolsables, salvo que la ley aplicable exija lo contrario o que exista un error de facturación por nuestra parte. Si crees que se ha producido un cobro incorrecto, escríbenos dentro de los 14 días siguientes al cargo y lo revisaremos.</p><h2>4. Periodo de prueba</h2><p>Si contratas un periodo de prueba, podrás usar el Servicio durante ese periodo; al finalizar, la suscripción continúa automáticamente al precio indicado, salvo que canceles antes.</p><h2>5. Contacto de facturación</h2><p><a href='mailto:{email}'>{email}</a> · {company} · {address}.</p>" },
  { key: "legal.help.title", grupo: "Legales", label: "Ayuda · título", value: "Ayuda y soporte", orden: 7 },
  { key: "legal.help.body", grupo: "Legales", label: "Ayuda · cuerpo (HTML)", multiline: true, orden: 8, value: "<p>¿Necesitas ayuda con {brand}? Estamos para ayudarte.</p><p>Escríbenos a <a href='mailto:{email}'>{email}</a> y te responderemos lo antes posible, normalmente en un plazo de 24-48 horas laborables.</p><p>Para gestionar tu suscripción (cambiar de plan o cancelar) accede a tu cuenta. Consulta también nuestras <a href='/faq'>preguntas frecuentes</a>, los <a href='/terms'>Términos</a>, la <a href='/privacy'>Política de privacidad</a> y la <a href='/refund'>Política de reembolsos</a>.</p><p><strong>{company}</strong><br/>{address}</p>" },

  // ---- Acceso (login / registro) ----
  { key: "auth.login.title", grupo: "Acceso", label: "Login · título", value: "Inicia sesión", orden: 1 },
  { key: "auth.login.submit", grupo: "Acceso", label: "Login · botón", value: "Entrar", orden: 2 },
  { key: "auth.login.email", grupo: "Acceso", label: "Login · etiqueta email", value: "Email", orden: 3 },
  { key: "auth.login.password", grupo: "Acceso", label: "Login · etiqueta contraseña", value: "Contraseña", orden: 4 },
  { key: "auth.login.noAccount", grupo: "Acceso", label: "Login · enlace registro", value: "¿No tienes cuenta? Regístrate", orden: 5 },
  { key: "auth.register.title", grupo: "Acceso", label: "Registro · título", value: "Crea tu cuenta gratis", orden: 6 },
  { key: "auth.register.submit", grupo: "Acceso", label: "Registro · botón", value: "Crear cuenta", orden: 7 },
  { key: "auth.register.name", grupo: "Acceso", label: "Registro · etiqueta nombre", value: "Nombre", orden: 8 },
  { key: "auth.register.haveAccount", grupo: "Acceso", label: "Registro · enlace login", value: "¿Ya tienes cuenta? Inicia sesión", orden: 9 },

  // ---- Selector de idioma ----
  { key: "lang.label", grupo: "General", label: "Selector de idioma · etiqueta", value: "Idioma", orden: 1 },
];

/**
 * Carga todos los textos para un idioma, con los placeholders resueltos.
 * Capas (de menor a mayor prioridad):
 *   1) DEFAULT_CONTENT (español, base — garantiza que ninguna clave quede vacía)
 *   2) TRANSLATIONS[locale] (traducciones por defecto en código, si el idioma no es el base)
 *   3) SiteContent de la BD para ese `locale` (lo que el admin haya editado)
 */
export async function loadContent(locale: string = DEFAULT_LOCALE): Promise<Record<string, string>> {
  const lang = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const map: Record<string, string> = {};
  // 1) base español
  for (const d of DEFAULT_CONTENT) map[d.key] = d.value;
  // 2) traducciones en código (marketing + legales)
  if (lang !== DEFAULT_LOCALE) {
    const tr = TRANSLATIONS[lang] || {};
    for (const k of Object.keys(tr)) map[k] = tr[k]!;
    const lg = LEGAL_TRANSLATIONS[lang] || {};
    for (const k of Object.keys(lg)) map[k] = lg[k]!;
  }
  // 3) overrides de BD para ese idioma
  try {
    const prisma = await getPrisma();
    const rows = await prisma.siteContent.findMany({ where: { locale: lang } });
    for (const r of rows as { key: string; value: string }[]) map[r.key] = r.value;
  } catch { /* BD no disponible → usa defaults/traducciones */ }
  // Resolución de placeholders (marca, empresa, dirección, email de contacto).
  const brand = map["brand.name"] || "Voice2Text";
  const company = map["company.name"] || "";
  const address = map["company.address"] || "";
  const email = map["contact.email"] || "";
  for (const k of Object.keys(map)) {
    map[k] = (map[k] ?? "")
      .replaceAll("{brand}", brand)
      .replaceAll("{company}", company)
      .replaceAll("{address}", address)
      .replaceAll("{email}", email);
  }
  return map;
}

/** Lee el idioma actual (lo inyecta el middleware en la cabecera `x-locale`). Server-only.
 *  Importa `next/headers` de forma diferida para no romper scripts Node (seed) que sólo usan DEFAULT_CONTENT. */
export async function getLocale(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const l = h.get("x-locale");
    if (isLocale(l)) return l!;
  } catch { /* fuera de request */ }
  return DEFAULT_LOCALE;
}

/** Helper: t(map, "clave") con fallback vacío. */
export const t = (m: Record<string, string>, key: string): string => m[key] ?? "";
