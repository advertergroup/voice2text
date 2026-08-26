import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RE_CANCEL, RE_CARGO, RE_REFUND, limpiarCitas, extraerEmails, detectarIdioma, plantillaNoEsNuestro, esAsuntoNuestro, sinPrefijosAsunto, dmarcDe,
  TEXTOS, TEXTOS_AVISO_TITULAR, PLATAFORMAS_SIMILARES, type Lang,
} from "../src/lib/support-texto.ts";

const LANGS: Lang[] = ["en", "es", "de", "fr", "it", "nl", "pl", "pt"];

// --- Casos reales del buzón support@ (agosto 2026) ---
const MARIO = "Hi, I cannot remember registering your website, for some reason i just saw that i am paying for VOICE2TEXT. Please immediately cancel my abo -- see the credit card infos. My Name: Mario Krenn Please cancel immediately. I would also strongly encourage giving me the money back for the last months, or explain to me why i had to pay. Thank you! Mario";
const GUADALUPE = "Hola, a quien corresponda: Solicito la baja total de mi cuenta y la cancelación inmediata de cualquier cobro recurrente asociado a mi tarjeta con terminación 0036. Su plataforma indica que no tengo un plan activo, sin embargo, el sistema sigue intentando realizar cobros a mi cuenta. No autorizo ningún cargo posterior.";
const GUADALUPE_REPLY = "El pago se realizó al comercio VOICE2TEXT con el número de autorización 092686 y tarjeta terminación 0036. Si no encuentran mi cuenta con este correo, les exijo que busquen el cobro en su sistema.\n\nEl dom, 23 ago 2026 a la(s) 5:05 p.m., Voice2Text (support@voicetotexts.net) escribió:\n\n> We couldn't find an account under this email address.\n>\n> Please write us from the email you used at voicetotexts.net, or reply\n> with that email address.\n";
const ADRIENNE_1 = "Please cancel my subscription The email address is either the one above or it's one OneHornHalfAHalo@gmail.com";
const ADRIENNE_2 = "Okay well I'm being charged a recording charge $50 and I need to cancel this subscription";
// Respuesta que SOLO cita nuestro email explicativo (que contiene «cancellation», «subscription», «charge»).
const CONFIRM_REPLY = "Yes, that's my email.\n\nOn Wed, Aug 26, 2026 at 10:00 AM Voice2Text <support@voicetotexts.net>\nwrote:\n\n> So there is no active subscription or charge from Voice2Text.\n> search your inbox for that name to find their cancellation link.\n> If you can't identify the merchant, your bank can help you stop the charge.\n";

test("intención: los casos reales se detectan como cancelación/cobro", () => {
  assert.ok(RE_CANCEL.test(MARIO));
  assert.ok(RE_REFUND.test(MARIO), "money back = reembolso");
  assert.ok(RE_CANCEL.test(GUADALUPE));
  assert.ok(RE_CANCEL.test(ADRIENNE_1));
  assert.ok(RE_CANCEL.test(ADRIENNE_2) && RE_CARGO.test(ADRIENNE_2));
  assert.ok(RE_CARGO.test("Why was I charged $49.99 yesterday?"));
  assert.ok(RE_REFUND.test("Ich möchte eine Erstattung"));
  assert.ok(RE_CANCEL.test("Je souhaite résilier mon abonnement"));
  assert.ok(!RE_CANCEL.test("How do I export to SRT?") && !RE_CARGO.test("How do I export to SRT?"));
});

test("limpiarCitas: una respuesta que solo cita nuestro email no dispara la intención", () => {
  assert.ok(RE_CANCEL.test(CONFIRM_REPLY), "sin limpiar sí matchea (por lo citado)");
  const limpio = limpiarCitas(CONFIRM_REPLY);
  assert.equal(limpio, "Yes, that's my email.");
  assert.ok(!RE_CANCEL.test(limpio) && !RE_CARGO.test(limpio));
});

test("limpiarCitas: corta en el «escribió:» de Gmail en español y conserva lo escrito", () => {
  const limpio = limpiarCitas(GUADALUPE_REPLY);
  assert.ok(limpio.startsWith("El pago se realizó al comercio VOICE2TEXT"));
  assert.ok(!limpio.includes("We couldn't find"));
  assert.ok(!limpio.includes("escribió:"));
});

test("limpiarCitas: NO corta en frases del usuario que empiezan por El/On/Le (solo en cabeceras con fecha)", () => {
  const es = "Hola,\nEl cobro de VOICE2TEXT no lo reconozco, cancelen mi suscripción.\n\nEl dom, 23 ago 2026 a la(s) 5:05 p.m., Voice2Text (support@voicetotexts.net) escribió:\n> lo citado";
  const esL = limpiarCitas(es);
  assert.ok(esL.includes("cancelen mi suscripción") && !esL.includes("escribió:") && !esL.includes("lo citado"));
  const es2 = "El cargo de $49.95 sigue apareciendo. El correo que usé es otro@gmail.com.\n\nEl mié, 26 ago 2026 a las 10:00, Voice2Text <support@voicetotexts.net> escribió:\n> lo citado";
  const es2L = limpiarCitas(es2);
  assert.ok(es2L.includes("otro@gmail.com") && !es2L.includes("lo citado"));
  const en = "On my statement I see VOICE2TEXT, please cancel.\n\nOn Wed, Aug 26, 2026 at 10:00 AM Voice2Text <support@voicetotexts.net>\nwrote:\n> quoted";
  const enL = limpiarCitas(en);
  assert.ok(enL.includes("please cancel") && !enL.includes("wrote:") && !enL.includes("quoted"));
  const fr = "Bonjour,\nLe prélèvement VOICE2TEXT n'est pas à moi, annulez.\n\nLe mer. 26 août 2026 à 10:00, Voice2Text <support@voicetotexts.net> a écrit :\n> cité";
  const frL = limpiarCitas(fr);
  assert.ok(frL.includes("annulez") && !frL.includes("a écrit") && !frL.includes("cité"));
  const ios = "Ok thanks\n\n> On Aug 26, 2026, at 10:00 AM, Voice2Text <support@voicetotexts.net> wrote:\n> \n> body";
  assert.equal(limpiarCitas(ios), "Ok thanks");
  const de = "Bitte kündigen.\n\nAm Mi., 26. Aug. 2026 um 10:00 Uhr schrieb Voice2Text <support@voicetotexts.net>:\n> zitiert";
  assert.equal(limpiarCitas(de), "Bitte kündigen.");
});

test("intención: «baja calidad» y «cuánto dinero» NO son cancelación/reembolso; las formas reales sí", () => {
  assert.ok(!RE_CANCEL.test("La transcripción es de muy baja calidad, ¿cómo mejoro la precisión?"));
  assert.ok(!RE_CANCEL.test("se oye la voz muy baja"));
  assert.ok(!RE_REFUND.test("¿cuánto dinero cuesta el plan mensual?"));
  assert.ok(RE_CANCEL.test("quiero darme de baja") && RE_CANCEL.test("Solicito la baja total") && RE_CANCEL.test("Baja inmediata de mi cuenta"));
  assert.ok(RE_REFUND.test("devuelvan el dinero") && RE_REFUND.test("quiero mi dinero") && RE_REFUND.test("I want my money back"));
});

test("queja de cobro: las frases habituales disparan RE_CARGO; una pregunta de uso no", () => {
  for (const s of [
    "There is a charge from VOICE2TEXT on my credit card for $49.95 that I did not authorize.",
    "I did not authorize this charge.", "Why are you charging me? Stop it.", "I see a charge of $49.95",
    "Unauthorized transaction on my card", "My account was debited 49.95", "I am paying for VOICE2TEXT",
    "Me cobraron 49,95", "Me están cobrando todos los meses", "Pagué 49,95 y no sé por qué",
  ]) assert.ok(RE_CARGO.test(s), s);
  assert.ok(!RE_CARGO.test("How do I export to SRT?") && !RE_CARGO.test("¿Cómo descargo el PDF?"));
});

test("asunto: las respuestas a NUESTROS emails no aportan intención (contienen «canceled», «refund»…)", () => {
  for (const s of [
    "Re: Your subscription has been canceled — Voice2Text", "RE: Re: About your request — Voice2Text",
    "Fwd: Your refund has been issued — Voice2Text", "AW: Zu Ihrer Anfrage — Voice2Text", "Re: Sobre tu solicitud — Voice2Text",
    "Re: Security notice — Voice2Text",
  ]) assert.ok(esAsuntoNuestro(s), s);
  for (const s of ["Cancel abo VOICE2TEXT", "CANCEL", "Re: cancel my subscription", "Voice2Text refund", "Cancelación inmediata de \"cuenta\" y baja de datos"]) assert.ok(!esAsuntoNuestro(s), s);
  assert.equal(sinPrefijosAsunto("RE: Re: FW: hola"), "hola");
  // Con el asunto «neutralizado», un «Awesome, thank you!» ya no es una cancelación.
  const texto = `${esAsuntoNuestro("Re: Your subscription has been canceled — Voice2Text") ? "" : "x"}\nAwesome, thank you so much!`;
  assert.ok(!RE_CANCEL.test(texto) && !RE_REFUND.test(texto) && !RE_CARGO.test(texto));
});

test("dmarcDe: lee X-Spamd-Result de rspamd y Authentication-Results propias; fail gana; ajenas se ignoran", () => {
  const h = (o: Record<string, unknown>) => ({ get: (k: string) => o[k] });
  // Gmail real (cabecera tal cual la escribe rspamd en mail.voicetotexts.net)
  assert.equal(dmarcDe(h({ "x-spamd-result": "default: False [-4.10 / 11.00];\n\tR_SPF_ALLOW(-0.20)[+ip4:209.85.128.0/17];\n\tDMARC_POLICY_ALLOW(-0.50)[gmail.com,none];\n\tR_DKIM_ALLOW(-0.20)[gmail.com:s=20230601]" })), "pass");
  assert.equal(dmarcDe(h({ "x-spamd-result": "default: False [3.10 / 11.00];\n\tDMARC_POLICY_SOFTFAIL(0.10)[gmail.com : No valid SPF, No valid DKIM,none]" })), "fail");
  assert.equal(dmarcDe(h({ "x-spamd-result": "default: False [1.00 / 11.00];\n\tDMARC_NA(0.00)[smallfirm.com]" })), "none");
  assert.equal(dmarcDe(h({})), "none");
  // Authentication-Results propias vs ajenas (forjadas o del salto anterior)
  assert.equal(dmarcDe(h({ "authentication-results": "mail.voicetotexts.net; dmarc=pass header.from=gmail.com" })), "pass");
  assert.equal(dmarcDe(h({ "authentication-results": ["mx.google.com; dmarc=pass header.from=x.com", "mail.voicetotexts.net; dmarc=fail header.from=x.com"] })), "fail");
  assert.equal(dmarcDe(h({ "authentication-results": "mx.google.com; dmarc=pass header.from=x.com" })), "none", "un pass ajeno no cuenta");
  // Forjado pass + real fail → fail
  assert.equal(dmarcDe(h({ "x-spamd-result": ["default: False; DMARC_POLICY_ALLOW(-0.5)[x]", "default: False; DMARC_POLICY_REJECT(2.0)[x]"] })), "fail");
});

test("limpiarCitas: cabecera Outlook y líneas «>»", () => {
  const t = "Please cancel.\n\nFrom: Voice2Text <support@voicetotexts.net>\nSent: Monday\nTo: me\nSubject: x\n\nquoted body";
  assert.equal(limpiarCitas(t), "Please cancel.");
  assert.equal(limpiarCitas("a\n> b\n>c\nd"), "a\nd");
});

test("extraerEmails: remitente primero, los mencionados después, sin los nuestros ni duplicados", () => {
  assert.deepEqual(extraerEmails("itsadriennebell@gmail.com", ADRIENNE_1), ["itsadriennebell@gmail.com", "onehornhalfahalo@gmail.com"]);
  assert.deepEqual(extraerEmails("A@B.com", "write to support@voicetotexts.net or a@b.com or help@voice2texts.com"), ["a@b.com"]);
  assert.deepEqual(extraerEmails("x@y.com", "Account: [x@y.com"), ["x@y.com"]);
  assert.equal(extraerEmails("x@y.com", "a@a.com b@b.com c@c.com d@d.com e@e.com").length, 4, "máximo 4");
});

test("detectarIdioma: casos reales y muestras de los 8 idiomas", () => {
  assert.equal(detectarIdioma(MARIO), "en");
  assert.equal(detectarIdioma(GUADALUPE), "es");
  assert.equal(detectarIdioma(limpiarCitas(GUADALUPE_REPLY)), "es");
  assert.equal(detectarIdioma(ADRIENNE_2), "en");
  assert.equal(detectarIdioma("Hallo, bitte kündigen Sie mein Abo sofort. Ich habe das nicht bestellt. Danke"), "de");
  assert.equal(detectarIdioma("Bonjour, je souhaite résilier mon abonnement immédiatement. Merci"), "fr");
  assert.equal(detectarIdioma("Buongiorno, vorrei disdire il mio abbonamento subito. Grazie"), "it");
  assert.equal(detectarIdioma("Olá, quero cancelar a minha assinatura imediatamente. Obrigado"), "pt");
  assert.equal(detectarIdioma("Hallo, ik wil graag mijn abonnement opzeggen. Bedankt"), "nl");
  assert.equal(detectarIdioma("Dzień dobry, proszę anulować moją subskrypcję. Dziękuję"), "pl");
  assert.equal(detectarIdioma(""), "en");
  assert.equal(detectarIdioma("CANCEL"), "en", "sin señal → inglés");
});

test("plantilla: contiene los emails comprobados, sus estados, la lista de plataformas y sin placeholders", () => {
  const { subject, html } = plantillaNoEsNuestro("en", [
    { email: "a@b.com", estado: "sin_cuenta" }, { email: "c@d.com", estado: "cuenta_gratis" }, { email: "e@f.com", estado: "cancelada" },
  ], "a@b.com");
  assert.equal(subject, TEXTOS.en.subject);
  assert.ok(html.includes("<b>a@b.com</b>") && html.includes("<b>c@d.com</b>") && html.includes("<b>e@f.com</b>"));
  assert.ok(html.includes(TEXTOS.en.label_no_account) && html.includes(TEXTOS.en.label_free_account) && html.includes(TEXTOS.en.label_already_canceled));
  assert.ok(html.includes("voice2texts.com"), "la plataforma original siempre en la lista");
  for (const p of PLATAFORMAS_SIMILARES) assert.ok(html.includes(p.donde) && html.includes(p.nombre));
  assert.ok(!html.includes("{email}"));
  assert.ok(html.includes("Voice2Text Support"));
});

test("plantilla: escapa HTML en los datos que vienen del email", () => {
  const { html } = plantillaNoEsNuestro("en", [{ email: "x<script>@y.com", estado: "sin_cuenta" }], "x<script>@y.com");
  assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;"));
});

test("los 8 idiomas están completos y renderizan", () => {
  for (const l of LANGS) {
    const t = TEXTOS[l];
    assert.ok(t, `faltan textos ${l}`);
    for (const [k, v] of Object.entries(t)) assert.ok(typeof v === "string" && v.length > 0, `${l}.${k} vacío`);
    assert.ok(t.conclusion.includes("{email}") && t.confirm.includes("{email}"), `${l} sin placeholder`);
    assert.ok(t.sign.includes("\n"), `${l} firma sin salto`);
    assert.ok(TEXTOS_AVISO_TITULAR[l]?.body.includes("{email}"), `${l} aviso_titular`);
    const { html } = plantillaNoEsNuestro(l, [{ email: "p@q.com", estado: "sin_cuenta" }], "p@q.com");
    assert.ok(html.includes("<b>p@q.com</b>") && !html.includes("{email}") && html.includes("voice2texts.com"), `${l} render`);
  }
});

test("plataformas similares: voice2texts.com primero, sin duplicados, todas con dónde encontrarlas", () => {
  assert.ok(PLATAFORMAS_SIMILARES[0].donde.startsWith("voice2texts.com"));
  const claves = PLATAFORMAS_SIMILARES.map((p) => p.nombre + "|" + p.donde);
  assert.equal(new Set(claves).size, claves.length);
  for (const p of PLATAFORMAS_SIMILARES) assert.ok(p.nombre.length > 1 && p.donde.length > 3);
});
