import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeDeRechazo, mereceReintento, _MENSAJES, _GENERICO, _LOCALES } from "../src/lib/rechazo-pago.ts";

// Por qué no ha pasado el pago, dicho para que el cliente pueda hacer algo.
// Stripe contesta casi siempre «Your card was declined»: la misma frase para
// quien no tiene saldo, para quien tiene el banco bloqueándole las
// suscripciones y para quien se equivocó con el CVC. Tres problemas con tres
// soluciones distintas y una sola frase que no lleva a ninguna.

test("sin saldo se le dice que no tiene saldo", () => {
  for (const codigo of ["insufficient_funds", "partner_insufficient_funds"]) {
    const es = mensajeDeRechazo({ decline_code: codigo }, "es");
    assert.match(es, /saldo/i, codigo);
    assert.match(es, /recárgala|otra tarjeta/i, `${codigo}: no dice qué hacer`);

    const en = mensajeDeRechazo({ decline_code: codigo }, "en");
    assert.match(en, /funds/i, codigo);
    assert.match(en, /top it up|different card/i, `${codigo}: no dice qué hacer`);
  }
});

test("cada motivo dice QUÉ pasó y QUÉ hacer", () => {
  const casos: [string, RegExp][] = [
    ["do_not_honor", /banco|app del banco|otra tarjeta/i],
    ["try_again_later", /espera|inténtalo|intentarlo/i],
    ["transaction_not_allowed", /prepago|virtuales|débito|crédito/i],
    ["expired_card", /caducada|vigente/i],
    ["incorrect_cvc", /código de seguridad/i],
    ["incorrect_number", /número de la tarjeta/i],
    ["card_velocity_exceeded", /límite/i],
    ["authentication_required", /confirmar|verificación/i],
  ];
  for (const [codigo, esperado] of casos) {
    const m = mensajeDeRechazo({ decline_code: codigo }, "es");
    assert.match(m, esperado, `${codigo} → "${m}"`);
  }
});

test("los códigos de VALIDACIÓN llegan por `code`, no por decline_code", () => {
  // Stripe.js manda incorrect_cvc/incorrect_number/expired_card en `code`.
  assert.match(mensajeDeRechazo({ code: "incorrect_cvc" }, "es"), /código de seguridad/i);
  assert.match(mensajeDeRechazo({ code: "expired_card" }, "es"), /caducada/i);
  assert.match(mensajeDeRechazo({ code: "incorrect_zip" }, "es"), /código postal/i);
});

test("NO se le confirma a nadie que su tarjeta consta como robada", () => {
  // Decírselo a quien la tiene en la mano es avisar a un posible defraudador de
  // que la tarjeta ya está marcada. Stripe lo desaconseja expresamente. Se le
  // da el mensaje del banco, que además es la acción correcta: que llame.
  for (const codigo of ["lost_card", "stolen_card", "pickup_card", "fraudulent", "restricted_card"]) {
    const m = mensajeDeRechazo({ decline_code: codigo }, "es");
    assert.doesNotMatch(m, /robad|perdid|fraud|retir/i, `${codigo} filtra el motivo real: "${m}"`);
    assert.match(m, /banco/i, `${codigo} debería mandarle a su banco`);
  }
});

test("nunca se queda sin mensaje", () => {
  // Callar es la única opción que no vale: el cliente se queda mirando un botón
  // que no hace nada.
  for (const err of [null, undefined, {}, { code: "codigo_que_no_existe" }]) {
    for (const loc of _LOCALES) {
      const m = mensajeDeRechazo(err as any, loc);
      assert.ok(m && m.length > 10, `${JSON.stringify(err)}/${loc} → "${m}"`);
    }
  }
  // Si Stripe manda un texto y no reconocemos el código, se respeta el suyo.
  assert.equal(mensajeDeRechazo({ code: "raro", message: "Algo muy concreto." }, "es"), "Algo muy concreto.");
});

test("un idioma desconocido cae a inglés, nunca vacío", () => {
  const m = mensajeDeRechazo({ decline_code: "insufficient_funds" }, "xx");
  assert.equal(m, _MENSAJES.sinSaldo.en);
});

test("ningún mensaje se queda sin traducir en los 9 idiomas", () => {
  // Un mensaje con un idioma a medias enseñaría "undefined" o vacío al cliente.
  const todos = [...Object.entries(_MENSAJES), ["_GENERICO", _GENERICO] as const];
  for (const [nombre, textos] of todos) {
    for (const loc of _LOCALES) {
      const t = (textos as Record<string, string>)[loc];
      assert.ok(t && t.trim().length > 5, `${nombre} sin ${loc}: "${t}"`);
    }
  }
});

test("solo se invita a reintentar cuando tiene sentido", () => {
  assert.ok(mereceReintento({ decline_code: "try_again_later" }));
  assert.ok(mereceReintento({ decline_code: "processing_error" }));
  // Reintentar sin saldo es hacerle perder el tiempo y sumar un rechazo más en
  // el historial de la tarjeta.
  assert.equal(mereceReintento({ decline_code: "insufficient_funds" }), false);
  assert.equal(mereceReintento({ decline_code: "do_not_honor" }), false);
  assert.equal(mereceReintento(null), false);
});
