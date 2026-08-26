import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RE_CANCEL, RE_CARGO, RE_REFUND, limpiarCitas, extraerEmails, detectarIdioma, plantillaNoEsNuestro,
  TEXTOS, TEXTOS_OTRO_EMAIL, PLATAFORMAS_SIMILARES, type Lang,
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
    assert.ok(TEXTOS_OTRO_EMAIL[l]?.body.includes("{email}"), `${l} otro_email`);
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
