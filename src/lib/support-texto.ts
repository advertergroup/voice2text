/**
 * Lógica PURA del agente de soporte (sin Next, sin prisma, sin `@/`): se puede probar con `node --test`.
 *  - detección de intención (cancelar / reembolso / consulta de cobro)
 *  - limpieza de citas (para no re-procesar nuestro propio email citado en las respuestas)
 *  - extracción de emails mencionados
 *  - detección de idioma por stopwords (8 idiomas de la web) con fallback EN
 *  - plantilla "esa suscripción no es nuestra" en 8 idiomas
 */

export type Lang = "en" | "es" | "de" | "fr" | "it" | "nl" | "pl" | "pt";

// «baja» solo en sentido de darse de baja (no «baja calidad»); «dinero» solo como «mi/el/my dinero».
export const RE_REFUND = /refund|reembols|devoluci[oó]n|devolver|devuelv|money\s*back|(?:mi|el|my) dinero|charge\s*back|rembours|rimbors|erstatt|terugbetal|zwrot/i;
export const RE_CANCEL = /cancel|cancelar|anular|\b(?:la|de|dar\w*|solicito|pido|quiero)\s+baja\b|\bbaja\s+(?:de|total|inmediata|definitiva)\b|unsubscribe|stop (my )?subscription|no quiero (pagar|seguir)|end (my )?subscription|k[üu]ndig|r[ée]sili|annul|disdi|opzeg|anuluj|anulow/i;
/** Queja de cobro sin pedir explícitamente cancelar ("there is a charge from VOICE2TEXT", "me están cobrando"). */
// OJO: sin flag `u`, `\b` no funciona tras vocales acentuadas («pagué», «cobró») → lookahead `(?![a-záéíóúñ])`.
export const RE_CARGO = /\bcharg(?:e|es|ed|ing)\b|billed|debit|transaction|unauthori[sz]ed|\bpa(?:id|ying)\b|cobr(?:o|os|ado|an|ando|aron|ó)(?![a-záéíóúñ])|me cobr|\bcargos?\b|pagu[eé](?![a-záéíóúñ])|pagando|factur|abbuch|abgebucht|belast|pr[ée]l[eè]v|addebit|afgeschreven|pobran|obci[ąa]ż/i;

/** Quita las partes citadas de una respuesta (líneas «>» y todo lo que sigue a «On … wrote:» y equivalentes). */
export function limpiarCitas(texto: string): string {
  let t = texto.replace(/\r\n/g, "\n");
  // Cabeceras de cita «On <fecha> … wrote:» y equivalentes: exigen un dígito (la fecha) en los primeros 40
  // caracteres tras el marcador y como mucho UN salto de línea (Gmail parte la cabecera en dos), para no
  // cortar en una frase del usuario que empiece por «El …»/«On …»/«Le …».
  const F = "[^\\n]{0,40}?\\d[^\\n]*(?:\\n[^\\n]*)?";
  const cortes: RegExp[] = [
    new RegExp("\\n\\s*On " + F + "wrote:"),                        // EN (Gmail, Apple Mail)
    new RegExp("\\n\\s*El " + F + "escribi[oó]:"),                  // ES
    new RegExp("\\n\\s*Am " + F + "schrieb[^\\n]{0,60}:"),          // DE
    new RegExp("\\n\\s*Le " + F + "a écrit\\s*:"),                  // FR
    new RegExp("\\n\\s*Il " + F + "ha scritto:"),                   // IT
    new RegExp("\\n\\s*Em " + F + "escreveu:"),                     // PT
    new RegExp("\\n\\s*Op " + F + "schreef[^\\n]{0,60}:"),          // NL
    new RegExp("\\n\\s*(?:W dniu|Dnia) " + F + "napisa[łl][^\\n]{0,20}:"), // PL
    /\n-{2,}\s*(Original Message|Mensaje original|Ursprüngliche Nachricht|Message d'origine)/i,
    /\n\s*From:\s.+\n\s*Sent:\s/i,                  // Outlook
    /\n\s*_{5,}\s*\n/,
  ];
  let idx = t.length;
  for (const re of cortes) { const m = re.exec(t); if (m && m.index < idx) idx = m.index; }
  t = t.slice(0, idx);
  return t.split("\n").filter((l) => !/^\s*>/.test(l)).join("\n").trim();
}

/** Quita prefijos de respuesta/reenvío del asunto (Re:, RE:, Fwd:, AW:, SV:, TR:, RIF:, WG:, ODP:, ENC:, R:, RV:…). */
export function sinPrefijosAsunto(subject: string): string {
  let s = subject.trim();
  for (let i = 0; i < 6; i++) {
    const t = s.replace(/^(?:re|fwd?|fw|aw|sv|tr|rif|wg|odp|enc|rv|r|vs|ynt)\s*(?:\[\d+\])?\s*:\s*/i, "");
    if (t === s) break;
    s = t.trim();
  }
  return s;
}

/** ¿El asunto es (una respuesta a) un email NUESTRO? Nuestros asuntos terminan en «— Voice2Text»: su texto no es una petición. */
export function esAsuntoNuestro(subject: string): boolean {
  return /[—–-]\s*Voice2Text\s*$/i.test(sinPrefijosAsunto(subject));
}

/**
 * Resultado DMARC del email según lo que escribió NUESTRO MTA (mail.voicetotexts.net):
 *  - cabeceras Authentication-Results cuyo authserv-id es el nuestro (las ajenas podrían venir forjadas), y
 *  - X-Spamd-Result de rspamd (símbolos DMARC_POLICY_ALLOW / REJECT / QUARANTINE / SOFTFAIL; DMARC_NA = sin DMARC).
 * «fail» gana a «pass»; sin señal → «none».
 */
export function dmarcDe(headers: { get(k: string): unknown }, authserv = "mail.voicetotexts.net"): "pass" | "fail" | "none" {
  const lista = (k: string) => { const raw = headers.get(k); return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((h) => String((h as any)?.value ?? h)); };
  const propias = lista("authentication-results").filter((h) => h.trim().toLowerCase().startsWith(authserv.toLowerCase())).join("\n");
  const spamd = lista("x-spamd-result").join("\n");
  if (/dmarc=fail/i.test(propias) || /DMARC_POLICY_(?:REJECT|QUARANTINE|SOFTFAIL)\b/.test(spamd)) return "fail";
  if (/dmarc=pass/i.test(propias) || /DMARC_POLICY_ALLOW\b/.test(spamd)) return "pass";
  return "none";
}

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const DOMINIOS_EXCLUIDOS = /@(voicetotexts\.net|voice2texts\.com|voice2text\.com|example\.com)$/i;

/** Emails candidatos a comprobar: el remitente + los que menciona en asunto/cuerpo (sin los nuestros ni de la competencia). */
export function extraerEmails(remitente: string, texto: string, max = 4): string[] {
  const out: string[] = [];
  const add = (e: string) => { const k = e.trim().toLowerCase(); if (k && !DOMINIOS_EXCLUIDOS.test(k) && !/no-?reply|mailer-daemon/.test(k) && !out.includes(k)) out.push(k); };
  add(remitente);
  for (const m of texto.match(RE_EMAIL) || []) add(m);
  return out.slice(0, max);
}

const STOP: Record<Lang, string[]> = {
  en: ["the", "and", "my", "please", "i", "to", "of", "subscription", "cancel", "charged", "you", "is", "this", "for", "with", "me", "am", "was", "have", "want", "immediately", "account", "thank", "thanks", "hi", "hello"],
  es: ["el", "los", "las", "que", "por", "para", "con", "una", "mi", "cuenta", "cobro", "cobros", "cancelar", "cancelación", "suscripción", "hola", "gracias", "del", "es", "solicito", "quiero", "tarjeta", "pago", "inmediata", "ninguna", "ningún", "saludos", "buenas"],
  de: ["und", "ich", "die", "der", "das", "nicht", "bitte", "mein", "meine", "abo", "abonnement", "kündigen", "kündigung", "ist", "mit", "für", "sie", "habe", "hallo", "danke", "sofort", "konto", "guten"],
  fr: ["je", "mon", "ma", "abonnement", "résilier", "résiliation", "annuler", "merci", "bonjour", "et", "pour", "pas", "vous", "est", "veuillez", "immédiatement", "compte", "carte", "cordialement", "ne"],
  it: ["il", "di", "che", "non", "per", "abbonamento", "annullare", "disdire", "disdetta", "grazie", "sono", "ho", "con", "mio", "buongiorno", "salve", "subito", "conto", "carta", "cordiali", "vorrei"],
  nl: ["het", "een", "ik", "mijn", "niet", "abonnement", "opzeggen", "alstublieft", "bedankt", "en", "van", "dat", "graag", "wil", "direct", "rekening", "hallo", "groet", "met"],
  pl: ["nie", "jest", "proszę", "subskrypcję", "subskrypcja", "subskrypcji", "anulować", "anuluj", "mój", "moja", "dziękuję", "się", "na", "że", "chcę", "konto", "natychmiast", "pozdrawiam", "dzień", "dobry"],
  pt: ["não", "para", "com", "uma", "meu", "minha", "assinatura", "cancelar", "cancelamento", "obrigado", "obrigada", "olá", "quero", "conta", "cartão", "imediatamente", "por", "favor", "cobrança", "você", "está"],
};

/** Idioma probable del email (stopwords). Si no hay señal clara → "en". */
export function detectarIdioma(texto: string): Lang {
  const palabras = texto.toLowerCase().match(/[\p{L}]+/gu) || [];
  if (!palabras.length) return "en";
  const puntos: Record<Lang, number> = { en: 0, es: 0, de: 0, fr: 0, it: 0, nl: 0, pl: 0, pt: 0 };
  for (const p of palabras) for (const l of Object.keys(STOP) as Lang[]) if (STOP[l].includes(p)) puntos[l]++;
  let mejor: Lang = "en", max = 0, segundo = 0;
  for (const l of Object.keys(puntos) as Lang[]) {
    if (puntos[l] > max) { segundo = max; max = puntos[l]; mejor = l; }
    else if (puntos[l] > segundo) segundo = puntos[l];
  }
  // Exige señal mínima y margen sobre el segundo idioma; en caso de duda, inglés.
  if (max < 2 || (mejor !== "en" && max - segundo < 1)) return "en";
  return mejor;
}

/**
 * Plataformas de transcripción con nombre parecido que cobran suscripción (verificadas 2026-08-26 vía workflow:
 * sitio vivo + planes de pago). La gente nos confunde sobre todo con voice2texts.com (mismo nombre, dominio casi igual,
 * descriptor de tarjeta "VOICE2TEXT"). Orden = probabilidad de ser el origen real del cobro.
 */
export const PLATAFORMAS_SIMILARES: { nombre: string; donde: string }[] = [
  { nombre: "Voice2Text", donde: "voice2texts.com ($49.95 / €39.90)" },
  { nombre: "Voice2Text – Voice To Text (app)", donde: "App Store / Google Play" },
  { nombre: "Voice To Text Online", donde: "voicetotextonline.com" },
  { nombre: "Voice to Text Pro – Transcribe (app)", donde: "App Store" },
  { nombre: "TranscribeToText.AI", donde: "transcribetotext.ai" },
  { nombre: "Transcribe", donde: "transcribe.com" },
  { nombre: "Transcribe", donde: "transcribe.org" },
  { nombre: "TalkType", donde: "talk-type.com" },
  { nombre: "Transkriptor", donde: "transkriptor.com" },
  { nombre: "Notta", donde: "notta.ai" },
];

export interface ComprobacionEmail { email: string; estado: "sin_cuenta" | "cuenta_gratis" | "cancelada" }

type Textos = {
  greeting: string; sorry: string; checked_intro: string; label_no_account: string; label_free_account: string;
  label_already_canceled: string; conclusion: string; confirm: string; similar_intro: string; tip: string; ours: string;
  close: string; sign: string; subject: string;
};

export const TEXTOS: Record<Lang, Textos> = {
  en: {
    greeting: "Hi,",
    sorry: "We're really sorry you're dealing with an unexpected charge — we know how frustrating that is, and we'd like to help you sort it out.",
    checked_intro: "We've checked our system for the email address(es) you wrote from or mentioned:",
    label_no_account: "no account found",
    label_free_account: "free account — never charged, no subscription",
    label_already_canceled: "subscription already canceled — no further charges from us",
    conclusion: "So there is no active subscription or charge from Voice2Text (voicetotexts.net) linked to {email}.",
    confirm: "Could you confirm that {email} is the email you used when you signed up? If you used a different address, just reply with it and we'll check again right away.",
    similar_intro: "One important thing: there are several other transcription services with very similar names, and they get mixed up all the time. If the charge on your statement isn't from voicetotexts.net, it's most likely from one of these:",
    tip: "Tip: the merchant name shown next to the charge on your card statement (or the receipt email you received when you signed up) tells you which company charged you — search your inbox for that name to find their cancellation link. If you can't identify the merchant, your bank can tell you who it is and help you stop the charge.",
    ours: "Charges from us always come from voicetotexts.net (1mmObj LLC), and you'd have a receipt from support@voicetotexts.net.",
    close: "If it turns out you do have an account with us, reply to this email and we'll take care of it right away.",
    sign: "Kind regards,\nVoice2Text Support",
    subject: "About your request — Voice2Text",
  },
  es: {
    greeting: "Hola,",
    sorry: "Lamentamos mucho que estés lidiando con un cobro inesperado — entendemos lo frustrante que es y queremos ayudarte a resolverlo.",
    checked_intro: "Hemos revisado nuestro sistema con la(s) dirección(es) de email desde la(s) que nos escribes o que mencionas:",
    label_no_account: "no existe ninguna cuenta",
    label_free_account: "cuenta gratuita — nunca se le ha cobrado nada, sin suscripción",
    label_already_canceled: "suscripción ya cancelada — no habrá más cobros por nuestra parte",
    conclusion: "Es decir, no hay ninguna suscripción activa ni ningún cobro de Voice2Text (voicetotexts.net) asociado a {email}.",
    confirm: "¿Podrías confirmarnos que {email} es el email que usaste al registrarte? Si usaste otra dirección, respóndenos con ella y lo comprobamos de inmediato.",
    similar_intro: "Un dato importante: existen varias plataformas de transcripción con nombres muy parecidos y es muy habitual confundirlas. Si el cobro de tu extracto no es de voicetotexts.net, lo más probable es que sea de una de estas:",
    tip: "Consejo: el nombre del comercio que aparece junto al cobro en el extracto de tu tarjeta (o el email de recibo que recibiste al darte de alta) indica qué empresa te cobró — busca ese nombre en tu bandeja de entrada para encontrar su enlace de cancelación. Si no logras identificar el comercio, tu banco puede decirte quién es y ayudarte a detener el cobro.",
    ours: "Los cobros nuestros siempre proceden de voicetotexts.net (1mmObj LLC) y tendrías un recibo de support@voicetotexts.net.",
    close: "Si resulta que sí tienes una cuenta con nosotros, responde a este email y lo resolvemos enseguida.",
    sign: "Un saludo,\nSoporte de Voice2Text",
    subject: "Sobre tu solicitud — Voice2Text",
  },
  // Traducciones DE/FR/IT/NL/PL/PT (generadas y revisadas por hablantes nativos vía workflow).
  de: {
      "greeting": "Hallo,",
      "sorry": "es tut uns wirklich leid, dass Sie sich mit einer unerwarteten Abbuchung herumschlagen müssen — wir wissen, wie ärgerlich das ist, und möchten Ihnen gerne helfen, das zu klären.",
      "checked_intro": "Wir haben in unserem System die E-Mail-Adresse(n) überprüft, von der/denen Sie uns geschrieben haben bzw. die Sie erwähnt haben:",
      "label_no_account": "kein Konto gefunden",
      "label_free_account": "kostenloses Konto — nie etwas abgebucht, kein Abonnement",
      "label_already_canceled": "Abonnement bereits gekündigt — keine weiteren Abbuchungen von uns",
      "conclusion": "Mit {email} ist also weder ein aktives Abonnement noch eine Abbuchung von Voice2Text (voicetotexts.net) verknüpft.",
      "confirm": "Könnten Sie uns bestätigen, dass {email} die E-Mail-Adresse ist, mit der Sie sich registriert haben? Falls Sie eine andere Adresse verwendet haben, antworten Sie einfach mit dieser Adresse, und wir prüfen es sofort noch einmal.",
      "similar_intro": "Ein wichtiger Hinweis: Es gibt mehrere andere Transkriptionsdienste mit sehr ähnlichen Namen, und sie werden ständig verwechselt. Wenn die Abbuchung auf Ihrem Kontoauszug nicht von voicetotexts.net stammt, kommt sie höchstwahrscheinlich von einem dieser Anbieter:",
      "tip": "Tipp: Der Händlername, der auf Ihrer Kartenabrechnung neben der Abbuchung steht (oder die Zahlungsbestätigung, die Sie bei der Anmeldung per E-Mail erhalten haben), verrät Ihnen, welches Unternehmen den Betrag abgebucht hat — suchen Sie in Ihrem Posteingang nach diesem Namen, um den Kündigungslink dieses Anbieters zu finden. Falls Sie den Händler nicht identifizieren können, kann Ihre Bank Ihnen sagen, wer dahintersteckt, und Ihnen helfen, die Abbuchung zu stoppen.",
      "ours": "Abbuchungen von uns kommen immer von voicetotexts.net (1mmObj LLC), und Sie hätten eine Zahlungsbestätigung von support@voicetotexts.net erhalten.",
      "close": "Sollte sich herausstellen, dass Sie doch ein Konto bei uns haben, antworten Sie einfach auf diese E-Mail, und wir kümmern uns sofort darum.",
      "sign": "Freundliche Grüße\nVoice2Text Support",
      "subject": "Zu Ihrer Anfrage — Voice2Text"
  },
  fr: {
      "greeting": "Bonjour,",
      "sorry": "Nous sommes vraiment désolés que vous ayez à faire face à un prélèvement inattendu — nous savons à quel point c'est frustrant, et nous aimerions vous aider à régler ce problème.",
      "checked_intro": "Nous avons vérifié dans notre système la ou les adresses e-mail depuis lesquelles vous nous écrivez ou que vous mentionnez :",
      "label_no_account": "aucun compte trouvé",
      "label_free_account": "compte gratuit — jamais facturé, aucun abonnement",
      "label_already_canceled": "abonnement déjà résilié — plus aucun prélèvement de notre part",
      "conclusion": "Il n'y a donc aucun abonnement actif ni aucun prélèvement de Voice2Text (voicetotexts.net) associé à {email}.",
      "confirm": "Pourriez-vous nous confirmer que {email} est bien l'adresse e-mail que vous avez utilisée lors de votre inscription ? Si vous avez utilisé une autre adresse, indiquez-la-nous simplement par retour d'e-mail et nous vérifierons à nouveau immédiatement.",
      "similar_intro": "Un point important : il existe plusieurs autres services de transcription aux noms très similaires, et on les confond très souvent. Si le prélèvement figurant sur votre relevé ne provient pas de voicetotexts.net, il s'agit très probablement de l'un de ceux-ci :",
      "tip": "Astuce : le nom du commerçant qui apparaît à côté du prélèvement sur votre relevé bancaire (ou sur le reçu envoyé par e-mail lors de votre inscription) vous indique quelle entreprise vous a facturé — recherchez ce nom dans votre boîte de réception pour retrouver son lien de résiliation. Si vous ne parvenez pas à identifier le commerçant, votre banque peut vous dire de qui il s'agit et vous aider à faire cesser le prélèvement.",
      "ours": "Les prélèvements de notre part proviennent toujours de voicetotexts.net (1mmObj LLC), et un reçu vous aurait été envoyé par support@voicetotexts.net.",
      "close": "S'il s'avère que vous avez bien un compte chez nous, répondez à cet e-mail et nous nous en occuperons immédiatement.",
      "sign": "Cordialement,\nL'équipe support Voice2Text",
      "subject": "À propos de votre demande — Voice2Text"
  },
  it: {
      "greeting": "Buongiorno,",
      "sorry": "Ci dispiace davvero che abbia riscontrato un addebito inaspettato — sappiamo quanto sia frustrante e vorremmo aiutarLa a risolvere la situazione.",
      "checked_intro": "Abbiamo verificato nel nostro sistema l'indirizzo (o gli indirizzi) email da cui ci ha scritto o che ha menzionato:",
      "label_no_account": "nessun account trovato",
      "label_free_account": "account gratuito — nessun addebito mai effettuato, nessun abbonamento",
      "label_already_canceled": "abbonamento già annullato — nessun ulteriore addebito da parte nostra",
      "conclusion": "Quindi non risulta alcun abbonamento attivo né alcun addebito di Voice2Text (voicetotexts.net) collegato a {email}.",
      "confirm": "Potrebbe confermarci che {email} è l'indirizzo email che ha utilizzato al momento della registrazione? Se ha usato un indirizzo diverso, ce lo comunichi rispondendo a questa email e faremo subito una nuova verifica.",
      "similar_intro": "Una cosa importante: esistono diversi altri servizi di trascrizione con nomi molto simili, che vengono confusi tra loro molto spesso. Se l'addebito sul Suo estratto conto non proviene da voicetotexts.net, molto probabilmente è stato effettuato da uno di questi:",
      "tip": "Suggerimento: il nome dell'esercente che compare accanto all'addebito nell'estratto conto della Sua carta (oppure nell'email con la ricevuta che Le è arrivata al momento della registrazione) indica quale azienda Le ha addebitato l'importo — cerchi quel nome nella Sua casella di posta per trovare il relativo link di disdetta. Se non riesce a identificare l'esercente, la Sua banca può dirLe di chi si tratta e aiutarLa a bloccare l'addebito.",
      "ours": "Gli addebiti da parte nostra provengono sempre da voicetotexts.net (1mmObj LLC) e sono sempre accompagnati da una ricevuta inviata da support@voicetotexts.net.",
      "close": "Se dovesse risultare che ha effettivamente un account presso di noi, risponda a questa email e ce ne occuperemo subito.",
      "sign": "Cordiali saluti,\nAssistenza Voice2Text",
      "subject": "In merito alla Sua richiesta — Voice2Text"
  },
  nl: {
      "greeting": "Hallo,",
      "sorry": "Het spijt ons echt dat u met een onverwachte afschrijving te maken heeft — we weten hoe vervelend dat is, en we helpen u graag om dit op te lossen.",
      "checked_intro": "We hebben in ons systeem gezocht naar het e-mailadres of de e-mailadressen waarmee u ons heeft gemaild of die u heeft genoemd:",
      "label_no_account": "geen account gevonden",
      "label_free_account": "gratis account — nooit iets in rekening gebracht, geen abonnement",
      "label_already_canceled": "abonnement al opgezegd — geen verdere afschrijvingen van ons",
      "conclusion": "Er is dus geen actief abonnement en geen afschrijving van Voice2Text (voicetotexts.net) gekoppeld aan {email}.",
      "confirm": "Kunt u bevestigen dat {email} het e-mailadres is waarmee u zich heeft aangemeld? Als u een ander adres heeft gebruikt, antwoord dan gewoon met dat adres en we controleren het meteen opnieuw.",
      "similar_intro": "Nog iets belangrijks: er zijn meerdere andere transcriptiediensten met zeer vergelijkbare namen, en die worden voortdurend met elkaar verward. Als de afschrijving op uw rekeningoverzicht niet van voicetotexts.net afkomstig is, is die hoogstwaarschijnlijk van een van deze:",
      "tip": "Tip: de bedrijfsnaam die naast de afschrijving op uw rekeningafschrift staat (of de ontvangstbevestiging die u per e-mail kreeg toen u zich aanmeldde) laat zien welk bedrijf het bedrag heeft afgeschreven — zoek in uw inbox op die naam om de opzeglink van dat bedrijf te vinden. Als u niet kunt achterhalen om welk bedrijf het gaat, kan uw bank u vertellen wie het is en u helpen de afschrijving stop te zetten.",
      "ours": "Afschrijvingen van ons komen altijd van voicetotexts.net (1mmObj LLC), en dan zou u ook een ontvangstbevestiging van support@voicetotexts.net moeten hebben.",
      "close": "Mocht blijken dat u toch een account bij ons heeft, beantwoord dan deze e-mail en we regelen het meteen.",
      "sign": "Met vriendelijke groet,\nVoice2Text Support",
      "subject": "Over uw verzoek — Voice2Text"
  },
  pl: {
      "greeting": "Dzień dobry,",
      "sorry": "Bardzo nam przykro, że mają Państwo do czynienia z nieoczekiwanym obciążeniem — wiemy, jak bardzo jest to frustrujące, i chętnie pomożemy Państwu to wyjaśnić.",
      "checked_intro": "Sprawdziliśmy w naszym systemie adres(y) e-mail, z których otrzymaliśmy wiadomość lub które zostały w niej wskazane:",
      "label_no_account": "nie znaleziono konta",
      "label_free_account": "konto bezpłatne — nigdy nie pobrano żadnej opłaty, brak subskrypcji",
      "label_already_canceled": "subskrypcja już anulowana — nie będzie kolejnych obciążeń z naszej strony",
      "conclusion": "Oznacza to, że z adresem {email} nie jest powiązana żadna aktywna subskrypcja ani żadne obciążenie ze strony Voice2Text (voicetotexts.net).",
      "confirm": "Czy mogą Państwo potwierdzić, że {email} to adres e-mail użyty przy rejestracji? Jeśli rejestracja odbyła się na inny adres, wystarczy podać go w odpowiedzi, a od razu sprawdzimy jeszcze raz.",
      "similar_intro": "Ważna uwaga: istnieje kilka innych serwisów do transkrypcji o bardzo podobnych nazwach i nagminnie są one ze sobą mylone. Jeśli obciążenie na Państwa wyciągu nie pochodzi z voicetotexts.net, najprawdopodobniej zostało pobrane przez jeden z poniższych serwisów:",
      "tip": "Wskazówka: nazwa sprzedawcy widoczna obok obciążenia na wyciągu z karty (lub e-mail z potwierdzeniem płatności otrzymany przy rejestracji) wskazuje, która firma pobrała opłatę — warto wyszukać tę nazwę w skrzynce odbiorczej, aby znaleźć link do anulowania subskrypcji. Jeśli nie uda się ustalić sprzedawcy, bank może wskazać, kto pobrał opłatę, i pomóc w zablokowaniu dalszych obciążeń.",
      "ours": "Obciążenia z naszej strony zawsze pochodzą z voicetotexts.net (1mmObj LLC), a potwierdzenie płatności otrzymaliby Państwo z adresu support@voicetotexts.net.",
      "close": "Jeśli okaże się, że jednak mają Państwo u nas konto, wystarczy odpowiedzieć na tę wiadomość, a od razu się tym zajmiemy.",
      "sign": "Pozdrawiamy,\nZespół wsparcia Voice2Text",
      "subject": "W sprawie Państwa zgłoszenia — Voice2Text"
  },
  pt: {
      "greeting": "Olá,",
      "sorry": "Lamentamos muito que tenha recebido uma cobrança inesperada — sabemos como isso é frustrante e gostaríamos de ajudar a resolver a situação.",
      "checked_intro": "Verificamos no nosso sistema o(s) endereço(s) de e-mail de onde nos escreveu ou que mencionou:",
      "label_no_account": "nenhuma conta encontrada",
      "label_free_account": "conta gratuita — nunca houve nenhuma cobrança, sem assinatura",
      "label_already_canceled": "assinatura já cancelada — não haverá mais cobranças da nossa parte",
      "conclusion": "Ou seja, não há nenhuma assinatura ativa nem qualquer cobrança da Voice2Text (voicetotexts.net) associada a {email}.",
      "confirm": "Poderia confirmar se {email} é o e-mail que usou ao criar a conta? Se usou outro endereço, basta responder com ele e verificamos novamente de imediato.",
      "similar_intro": "Um ponto importante: existem vários outros serviços de transcrição com nomes muito parecidos, e é muito comum confundi-los. Se a cobrança no seu extrato não for de voicetotexts.net, o mais provável é que seja de um destes:",
      "tip": "Dica: o nome do comerciante que aparece ao lado da cobrança no extrato do seu cartão (ou o e-mail de recibo que recebeu ao criar a conta) indica qual empresa fez a cobrança — procure esse nome na sua caixa de entrada para encontrar o link de cancelamento. Se não conseguir identificar o comerciante, o seu banco pode dizer quem é e ajudar a interromper a cobrança.",
      "ours": "As nossas cobranças vêm sempre de voicetotexts.net (1mmObj LLC), e teria recebido um recibo de support@voicetotexts.net.",
      "close": "Se, afinal, tiver mesmo uma conta na Voice2Text, responda a este e-mail e resolvemos de imediato.",
      "sign": "Atenciosamente,\nSuporte da Voice2Text",
      "subject": "Sobre a sua solicitação — Voice2Text"
  },
};

/** Aviso al TITULAR de una cuenta de pago cuando otro email pide cancelarla (al remitente nunca se le dice nada de terceros). */
export const TEXTOS_AVISO_TITULAR: Record<Lang, { subject: string; body: string }> = {
  en: {"subject":"Security notice — Voice2Text","body":"We've received a message from {email} asking us to cancel the subscription linked to this address. If that was you, simply reply to this email from this address and we'll take care of it right away. If it wasn't you, you can ignore this message — nothing has been changed on your account."},
  es: {"subject":"Aviso de seguridad — Voice2Text","body":"Hemos recibido un mensaje desde {email} pidiendo cancelar la suscripción asociada a esta dirección. Si has sido tú, responde a este email desde esta dirección y lo resolvemos enseguida. Si no has sido tú, puedes ignorar este mensaje: no se ha cambiado nada en tu cuenta."},
  de: {"subject":"Sicherheitshinweis — Voice2Text","body":"Wir haben eine Nachricht von {email} erhalten, in der wir gebeten werden, das mit dieser Adresse verknüpfte Abonnement zu kündigen. Falls Sie das waren, antworten Sie einfach von dieser Adresse aus auf diese E-Mail, und wir kümmern uns sofort darum. Falls Sie das nicht waren, können Sie diese Nachricht ignorieren – an Ihrem Konto wurde nichts geändert."},
  fr: {"subject":"Avis de sécurité — Voice2Text","body":"Nous avons reçu un message de {email} nous demandant d'annuler l'abonnement associé à cette adresse. Si c'était bien vous, il vous suffit de répondre à cet e-mail depuis cette adresse et nous nous en occuperons immédiatement. Si ce n'était pas vous, vous pouvez ignorer ce message : rien n'a été modifié sur votre compte."},
  it: {"subject":"Avviso di sicurezza — Voice2Text","body":"Abbiamo ricevuto un messaggio da {email} con la richiesta di annullare l'abbonamento associato a questo indirizzo. Se è stato Lei, Le basta rispondere a questa email da questo indirizzo e ce ne occuperemo subito. Se non è stato Lei, può ignorare questo messaggio: non è stata apportata alcuna modifica al Suo account."},
  nl: {"subject":"Beveiligingsmelding — Voice2Text","body":"We hebben een bericht ontvangen van {email} met het verzoek om het abonnement dat aan dit adres is gekoppeld op te zeggen. Als u dat zelf was, beantwoord dan gewoon deze e-mail vanaf dit adres en we regelen het meteen. Als u dat niet was, kunt u dit bericht negeren: er is niets aan uw account gewijzigd."},
  pl: {"subject":"Powiadomienie dotyczące bezpieczeństwa — Voice2Text","body":"Otrzymaliśmy wiadomość z adresu {email} z prośbą o anulowanie subskrypcji powiązanej z tym adresem. Jeśli to Państwo wysłali tę prośbę, wystarczy odpowiedzieć na ten e-mail z tego samego adresu, a niezwłocznie się tym zajmiemy. Jeśli to nie Państwo, można tę wiadomość zignorować — na Państwa koncie nic nie zostało zmienione."},
  pt: {"subject":"Aviso de segurança — Voice2Text","body":"Recebemos uma mensagem de {email} pedindo o cancelamento da assinatura associada a este endereço. Se foi você, basta responder a este e-mail a partir deste endereço e resolveremos de imediato. Se não foi você, pode ignorar esta mensagem: nada foi alterado na sua conta."},
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML + asunto del email "esa suscripción no es nuestra". */
export function plantillaNoEsNuestro(lang: Lang, comprobaciones: ComprobacionEmail[], principal: string): { subject: string; html: string } {
  const t = TEXTOS[lang] || TEXTOS.en;
  const label = (e: ComprobacionEmail) => e.estado === "cuenta_gratis" ? t.label_free_account : e.estado === "cancelada" ? t.label_already_canceled : t.label_no_account;
  const p = (s: string) => `<p>${esc(s).replace(/\{email\}/g, `<b>${esc(principal)}</b>`)}</p>`;
  const html = [
    p(t.greeting),
    p(t.sorry),
    p(t.checked_intro),
    `<ul>${comprobaciones.map((c) => `<li><b>${esc(c.email)}</b> — ${esc(label(c))}</li>`).join("")}</ul>`,
    p(t.conclusion),
    p(t.confirm),
    p(t.similar_intro),
    `<ul>${PLATAFORMAS_SIMILARES.map((x) => `<li><b>${esc(x.nombre)}</b> — ${esc(x.donde)}</li>`).join("")}</ul>`,
    p(t.tip),
    p(t.ours),
    p(t.close),
    `<p>${esc(t.sign).replace(/\n/g, "<br/>")}</p>`,
  ].join("\n");
  return { subject: t.subject, html };
}
