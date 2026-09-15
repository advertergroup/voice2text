// Por qué no ha pasado el pago, dicho para que el cliente pueda hacer algo.
//
// Portado de SnapPassport (personalitytests/src/lib/rechazo-pago.ts). Vive en un
// módulo suelto —sin React, sin Next, sin `@/`— porque es la parte que hay que
// poder probar sin montar un checkout. Diferencia con el original: aquí NO hay
// veto de marca (voice2text acepta Visa/Mastercard/Amex/Discover), así que esa
// rama se cae; y se traduce a los 9 idiomas de la web, no solo es/en.
//
// EL PROBLEMA QUE RESUELVE. Stripe contesta casi siempre lo mismo: «Your card
// was declined». Esa frase es la misma para quien no tiene saldo, para quien
// tiene el banco bloqueándole las suscripciones y para quien ha escrito mal el
// CVC. Tres problemas con tres soluciones distintas, y una sola frase que no
// lleva a ninguna. (En SnapPassport, de 164 rechazos de renovación, 46 eran
// falta de saldo pura: esa gente solo necesitaba saberlo.)
//
// LO QUE NO SE DICE NUNCA. Cuando el banco marca la tarjeta como perdida,
// robada o a retirar, se contesta con el mensaje genérico a propósito.
// Confirmarle a quien tiene la tarjeta en la mano que consta como robada es
// darle información a un posible defraudador, y Stripe lo desaconseja
// expresamente. Que llame a su banco.

/** Lo que Stripe devuelve cuando un cobro no sale (StripeError de Stripe.js). */
export type ErrorDePago = {
  decline_code?: string;
  code?: string;
  message?: string;
} | null | undefined;

/** Los 9 idiomas de la web. Un idioma desconocido cae a inglés. */
type Locale = "es" | "en" | "pt" | "fr" | "de" | "it" | "nl" | "pl" | "el";
type Textos = Record<Locale, string>;

const LOCALES_OK = new Set<Locale>(["es", "en", "pt", "fr", "de", "it", "nl", "pl", "el"]);
const idioma = (locale: string): Locale => (LOCALES_OK.has(locale as Locale) ? (locale as Locale) : "en");

// Mensajes únicos. Cada uno dice QUÉ pasó y QUÉ hacer, en ese orden. Un mensaje
// que solo dice qué pasó deja al cliente igual de parado que el genérico.
const M = {
  sinSaldo: {
    es: "Tu tarjeta no tiene saldo suficiente para este pago. Recárgala y vuelve a intentarlo, o paga con otra tarjeta.",
    en: "Your card doesn't have enough funds for this payment. Top it up and try again, or use a different card.",
    pt: "O teu cartão não tem saldo suficiente para este pagamento. Carrega-o e tenta de novo, ou paga com outro cartão.",
    fr: "Votre carte n'a pas de fonds suffisants pour ce paiement. Réapprovisionnez-la et réessayez, ou utilisez une autre carte.",
    de: "Deine Karte hat nicht genug Guthaben für diese Zahlung. Lade sie auf und versuche es erneut, oder nutze eine andere Karte.",
    it: "La tua carta non ha fondi sufficienti per questo pagamento. Ricaricala e riprova, oppure usa un'altra carta.",
    nl: "Je kaart heeft niet genoeg saldo voor deze betaling. Vul hem aan en probeer opnieuw, of gebruik een andere kaart.",
    pl: "Twoja karta nie ma wystarczających środków na tę płatność. Doładuj ją i spróbuj ponownie lub zapłać inną kartą.",
    el: "Η κάρτα σου δεν έχει αρκετό υπόλοιπο για αυτήν την πληρωμή. Γέμισέ την και δοκίμασε ξανά, ή πλήρωσε με άλλη κάρτα.",
  },
  bancoSinMotivo: {
    es: "Tu banco ha rechazado el pago sin dar un motivo. Suele arreglarse autorizándolo desde la app del banco, o pagando con otra tarjeta.",
    en: "Your bank declined the payment without giving a reason. Approving it in your banking app usually fixes it — or use a different card.",
    pt: "O teu banco recusou o pagamento sem dar um motivo. Costuma resolver-se autorizando-o na app do banco, ou pagando com outro cartão.",
    fr: "Votre banque a refusé le paiement sans donner de raison. L'autoriser depuis l'application de votre banque règle souvent le problème, ou utilisez une autre carte.",
    de: "Deine Bank hat die Zahlung ohne Angabe eines Grundes abgelehnt. Meist hilft es, sie in der Banking-App freizugeben, oder nutze eine andere Karte.",
    it: "La tua banca ha rifiutato il pagamento senza indicare un motivo. Di solito si risolve autorizzandolo dall'app della banca, oppure usa un'altra carta.",
    nl: "Je bank heeft de betaling geweigerd zonder reden. Het helpt meestal om hem goed te keuren in je bank-app, of gebruik een andere kaart.",
    pl: "Twój bank odrzucił płatność bez podania powodu. Zwykle pomaga zatwierdzenie jej w aplikacji banku lub zapłać inną kartą.",
    el: "Η τράπεζά σου απέρριψε την πληρωμή χωρίς να δώσει λόγο. Συνήθως διορθώνεται εγκρίνοντάς την από την εφαρμογή της τράπεζας, ή πλήρωσε με άλλη κάρτα.",
  },
  reintentar: {
    es: "Tu banco no ha podido responder ahora mismo. Espera un minuto y vuelve a intentarlo.",
    en: "Your bank couldn't respond right now. Wait a minute and try again.",
    pt: "O teu banco não conseguiu responder agora. Espera um minuto e tenta de novo.",
    fr: "Votre banque n'a pas pu répondre pour le moment. Attendez une minute et réessayez.",
    de: "Deine Bank konnte gerade nicht antworten. Warte eine Minute und versuche es erneut.",
    it: "La tua banca non è riuscita a rispondere adesso. Aspetta un minuto e riprova.",
    nl: "Je bank kon nu niet reageren. Wacht een minuut en probeer opnieuw.",
    pl: "Twój bank nie mógł teraz odpowiedzieć. Poczekaj minutę i spróbuj ponownie.",
    el: "Η τράπεζά σου δεν μπόρεσε να απαντήσει τώρα. Περίμενε ένα λεπτό και δοκίμασε ξανά.",
  },
  errorProceso: {
    es: "Ha habido un problema al procesar el pago. Espera un minuto y vuelve a intentarlo.",
    en: "Something went wrong processing the payment. Wait a minute and try again.",
    pt: "Ocorreu um problema ao processar o pagamento. Espera um minuto e tenta de novo.",
    fr: "Un problème est survenu lors du traitement du paiement. Attendez une minute et réessayez.",
    de: "Bei der Verarbeitung der Zahlung ist etwas schiefgegangen. Warte eine Minute und versuche es erneut.",
    it: "Si è verificato un problema durante l'elaborazione del pagamento. Aspetta un minuto e riprova.",
    nl: "Er ging iets mis bij het verwerken van de betaling. Wacht een minuut en probeer opnieuw.",
    pl: "Wystąpił problem podczas przetwarzania płatności. Poczekaj minutę i spróbuj ponownie.",
    el: "Παρουσιάστηκε πρόβλημα κατά την επεξεργασία της πληρωμής. Περίμενε ένα λεπτό και δοκίμασε ξανά.",
  },
  prepago: {
    es: "Esa tarjeta no admite este tipo de pago. Suele pasar con tarjetas de prepago y virtuales: paga con una de débito o crédito normal.",
    en: "That card doesn't allow this type of payment — common with prepaid and virtual cards. Please use a regular debit or credit card.",
    pt: "Esse cartão não permite este tipo de pagamento — é comum em cartões pré-pagos e virtuais. Usa um cartão de débito ou crédito normal.",
    fr: "Cette carte n'autorise pas ce type de paiement — fréquent avec les cartes prépayées et virtuelles. Utilisez une carte de débit ou de crédit classique.",
    de: "Diese Karte erlaubt diese Art von Zahlung nicht — häufig bei Prepaid- und virtuellen Karten. Bitte nutze eine normale Debit- oder Kreditkarte.",
    it: "Questa carta non consente questo tipo di pagamento — succede spesso con carte prepagate e virtuali. Usa una normale carta di debito o credito.",
    nl: "Deze kaart staat dit soort betaling niet toe — komt vaak voor bij prepaid- en virtuele kaarten. Gebruik een gewone debet- of creditcard.",
    pl: "Ta karta nie obsługuje tego typu płatności — częste w kartach przedpłaconych i wirtualnych. Zapłać zwykłą kartą debetową lub kredytową.",
    el: "Αυτή η κάρτα δεν επιτρέπει αυτόν τον τύπο πληρωμής — συχνό σε προπληρωμένες και εικονικές κάρτες. Χρησιμοποίησε μια κανονική χρεωστική ή πιστωτική κάρτα.",
  },
  tipoNoAdmitido: {
    es: "Esa tarjeta no admite este tipo de pago. Paga con una tarjeta de débito o crédito normal.",
    en: "That card doesn't support this type of payment. Please use a regular debit or credit card.",
    pt: "Esse cartão não suporta este tipo de pagamento. Usa um cartão de débito ou crédito normal.",
    fr: "Cette carte ne prend pas en charge ce type de paiement. Utilisez une carte de débit ou de crédit classique.",
    de: "Diese Karte unterstützt diese Art von Zahlung nicht. Bitte nutze eine normale Debit- oder Kreditkarte.",
    it: "Questa carta non supporta questo tipo di pagamento. Usa una normale carta di debito o credito.",
    nl: "Deze kaart ondersteunt dit soort betaling niet. Gebruik een gewone debet- of creditcard.",
    pl: "Ta karta nie obsługuje tego typu płatności. Zapłać zwykłą kartą debetową lub kredytową.",
    el: "Αυτή η κάρτα δεν υποστηρίζει αυτόν τον τύπο πληρωμής. Χρησιμοποίησε μια κανονική χρεωστική ή πιστωτική κάρτα.",
  },
  moneda: {
    es: "Tu tarjeta no admite pagos en esta moneda. Paga con otra tarjeta.",
    en: "Your card doesn't support this currency. Please use a different card.",
    pt: "O teu cartão não suporta pagamentos nesta moeda. Paga com outro cartão.",
    fr: "Votre carte ne prend pas en charge cette devise. Utilisez une autre carte.",
    de: "Deine Karte unterstützt diese Währung nicht. Bitte nutze eine andere Karte.",
    it: "La tua carta non supporta pagamenti in questa valuta. Usa un'altra carta.",
    nl: "Je kaart ondersteunt deze valuta niet. Gebruik een andere kaart.",
    pl: "Twoja karta nie obsługuje płatności w tej walucie. Zapłać inną kartą.",
    el: "Η κάρτα σου δεν υποστηρίζει πληρωμές σε αυτό το νόμισμα. Πλήρωσε με άλλη κάρτα.",
  },
  limite: {
    es: "Tu tarjeta ha superado su límite de operaciones. Espera un rato o paga con otra.",
    en: "Your card has hit its transaction limit. Wait a while or use a different card.",
    pt: "O teu cartão atingiu o limite de operações. Espera um pouco ou paga com outro.",
    fr: "Votre carte a atteint sa limite d'opérations. Attendez un moment ou utilisez une autre carte.",
    de: "Deine Karte hat ihr Transaktionslimit erreicht. Warte etwas oder nutze eine andere Karte.",
    it: "La tua carta ha raggiunto il limite di operazioni. Aspetta un po' o usa un'altra carta.",
    nl: "Je kaart heeft zijn transactielimiet bereikt. Wacht even of gebruik een andere kaart.",
    pl: "Twoja karta osiągnęła limit transakcji. Poczekaj chwilę lub zapłać inną.",
    el: "Η κάρτα σου έφτασε το όριο συναλλαγών. Περίμενε λίγο ή πλήρωσε με άλλη.",
  },
  caducada: {
    es: "Esa tarjeta está caducada. Usa una vigente.",
    en: "That card has expired. Please use a current one.",
    pt: "Esse cartão está expirado. Usa um válido.",
    fr: "Cette carte est expirée. Utilisez-en une valide.",
    de: "Diese Karte ist abgelaufen. Bitte nutze eine gültige.",
    it: "Questa carta è scaduta. Usane una valida.",
    nl: "Deze kaart is verlopen. Gebruik een geldige.",
    pl: "Ta karta wygasła. Użyj ważnej.",
    el: "Αυτή η κάρτα έχει λήξει. Χρησιμοποίησε μια σε ισχύ.",
  },
  cvc: {
    es: "El código de seguridad no es correcto. Son los 3 dígitos del reverso (4 delante, en American Express).",
    en: "The security code isn't right. It's the 3 digits on the back (4 on the front for American Express).",
    pt: "O código de segurança não está correto. São os 3 dígitos no verso (4 à frente, na American Express).",
    fr: "Le code de sécurité est incorrect. Ce sont les 3 chiffres au dos (4 au recto pour American Express).",
    de: "Die Prüfziffer stimmt nicht. Es sind die 3 Ziffern auf der Rückseite (4 auf der Vorderseite bei American Express).",
    it: "Il codice di sicurezza non è corretto. Sono le 3 cifre sul retro (4 sul fronte per American Express).",
    nl: "De beveiligingscode klopt niet. Het zijn de 3 cijfers op de achterkant (4 op de voorkant bij American Express).",
    pl: "Kod bezpieczeństwa jest nieprawidłowy. To 3 cyfry na odwrocie (4 z przodu w American Express).",
    el: "Ο κωδικός ασφαλείας δεν είναι σωστός. Είναι τα 3 ψηφία στο πίσω μέρος (4 μπροστά στην American Express).",
  },
  numero: {
    es: "El número de la tarjeta no es correcto. Revísalo y vuelve a escribirlo.",
    en: "That card number isn't right. Check it and type it again.",
    pt: "O número do cartão não está correto. Verifica-o e escreve-o de novo.",
    fr: "Le numéro de carte est incorrect. Vérifiez-le et saisissez-le à nouveau.",
    de: "Die Kartennummer stimmt nicht. Überprüfe sie und gib sie erneut ein.",
    it: "Il numero della carta non è corretto. Controllalo e digitalo di nuovo.",
    nl: "Het kaartnummer klopt niet. Controleer het en typ het opnieuw.",
    pl: "Numer karty jest nieprawidłowy. Sprawdź go i wpisz ponownie.",
    el: "Ο αριθμός της κάρτας δεν είναι σωστός. Έλεγξέ τον και πληκτρολόγησέ τον ξανά.",
  },
  caducidadFecha: {
    es: "La fecha de caducidad no es correcta. Revísala.",
    en: "The expiry date isn't right. Please check it.",
    pt: "A data de validade não está correta. Verifica-a.",
    fr: "La date d'expiration est incorrecte. Veuillez la vérifier.",
    de: "Das Ablaufdatum stimmt nicht. Bitte überprüfe es.",
    it: "La data di scadenza non è corretta. Controllala.",
    nl: "De vervaldatum klopt niet. Controleer hem.",
    pl: "Data ważności jest nieprawidłowa. Sprawdź ją.",
    el: "Η ημερομηνία λήξης δεν είναι σωστή. Έλεγξέ την.",
  },
  zip: {
    es: "El código postal no coincide con el de tu tarjeta. Revísalo.",
    en: "The postal code doesn't match your card. Please check it.",
    pt: "O código postal não corresponde ao do teu cartão. Verifica-o.",
    fr: "Le code postal ne correspond pas à celui de votre carte. Vérifiez-le.",
    de: "Die Postleitzahl stimmt nicht mit der deiner Karte überein. Bitte überprüfe sie.",
    it: "Il codice postale non corrisponde a quello della tua carta. Controllalo.",
    nl: "De postcode komt niet overeen met die van je kaart. Controleer hem.",
    pl: "Kod pocztowy nie zgadza się z tym na Twojej karcie. Sprawdź go.",
    el: "Ο ταχυδρομικός κώδικας δεν ταιριάζει με αυτόν της κάρτας σου. Έλεγξέ τον.",
  },
  autenticacion: {
    es: "Tu banco pide confirmar el pago. Vuelve a intentarlo y acepta la verificación que te llegue.",
    en: "Your bank needs to confirm this payment. Try again and approve the verification you receive.",
    pt: "O teu banco pede para confirmar o pagamento. Tenta de novo e aceita a verificação que receberes.",
    fr: "Votre banque demande de confirmer le paiement. Réessayez et acceptez la vérification que vous recevez.",
    de: "Deine Bank möchte diese Zahlung bestätigen. Versuche es erneut und bestätige die Verifizierung, die du erhältst.",
    it: "La tua banca chiede di confermare il pagamento. Riprova e accetta la verifica che ricevi.",
    nl: "Je bank wil deze betaling bevestigen. Probeer opnieuw en keur de verificatie goed die je ontvangt.",
    pl: "Twój bank prosi o potwierdzenie płatności. Spróbuj ponownie i zaakceptuj weryfikację, którą otrzymasz.",
    el: "Η τράπεζά σου ζητά να επιβεβαιώσεις την πληρωμή. Δοκίμασε ξανά και αποδέξου την επαλήθευση που θα λάβεις.",
  },
} satisfies Record<string, Textos>;

// Motivo de la red (decline_code o code de Stripe) → mensaje accionable.
const MOTIVOS: Record<string, Textos> = {
  insufficient_funds: M.sinSaldo,
  partner_insufficient_funds: M.sinSaldo,
  // El banco dice que no sin decir por qué. Ni con reintento ni desde aquí se
  // arregla: o lo autoriza el cliente con su banco, o usa otra tarjeta.
  do_not_honor: M.bancoSinMotivo,
  // generic_decline → GENERICO (definido abajo; se resuelve en mensajeDeRechazo).
  try_again_later: M.reintentar,
  processing_error: M.errorProceso,
  // Tarjetas que no admiten cobros recurrentes: muchas de prepago y virtuales.
  transaction_not_allowed: M.prepago,
  card_not_supported: M.tipoNoAdmitido,
  currency_not_supported: M.moneda,
  card_velocity_exceeded: M.limite,
  withdrawal_count_limit_exceeded: M.limite,
  expired_card: M.caducada,
  incorrect_cvc: M.cvc,
  invalid_cvc: M.cvc,
  incorrect_number: M.numero,
  invalid_number: M.numero,
  invalid_expiry_month: M.caducidadFecha,
  invalid_expiry_year: M.caducidadFecha,
  incorrect_zip: M.zip,
  authentication_required: M.autenticacion,
};

/**
 * Los motivos que NO se le cuentan al cliente.
 *
 * Tarjeta declarada perdida, robada o a retirar. Confirmárselo a quien la tiene
 * en la mano es avisar a un posible defraudador de que la tarjeta ya está
 * marcada; Stripe lo desaconseja expresamente. Se le da el mensaje del banco
 * genérico, que además es la acción correcta: llamar a su banco.
 */
const NO_SE_DICEN = new Set(["lost_card", "stolen_card", "pickup_card", "fraudulent", "merchant_blacklist", "restricted_card"]);

const GENERICO: Textos = {
  es: "Tu banco ha rechazado el pago. Prueba con otra tarjeta o llama al teléfono que viene detrás de la tuya.",
  en: "Your bank declined the payment. Try a different card, or call the number on the back of yours.",
  pt: "O teu banco recusou o pagamento. Tenta outro cartão ou liga para o número que está no verso do teu.",
  fr: "Votre banque a refusé le paiement. Essayez une autre carte ou appelez le numéro au dos de la vôtre.",
  de: "Deine Bank hat die Zahlung abgelehnt. Versuche eine andere Karte oder ruf die Nummer auf der Rückseite deiner Karte an.",
  it: "La tua banca ha rifiutato il pagamento. Prova un'altra carta o chiama il numero sul retro della tua.",
  nl: "Je bank heeft de betaling geweigerd. Probeer een andere kaart of bel het nummer op de achterkant van je kaart.",
  pl: "Twój bank odrzucił płatność. Spróbuj inną kartą lub zadzwoń pod numer na odwrocie swojej karty.",
  el: "Η τράπεζά σου απέρριψε την πληρωμή. Δοκίμασε άλλη κάρτα ή κάλεσε τον αριθμό στο πίσω μέρος της δικής σου.",
};

/**
 * El mensaje que ve el cliente cuando el pago no sale.
 *
 * ORDEN DE PRIORIDAD:
 * 1. Los que no se cuentan (perdida/robada) → mensaje del banco genérico.
 * 2. El motivo de la red traducido a algo accionable.
 * 3. Lo que dijera Stripe, tal cual. Nunca se deja al cliente sin nada.
 */
export function mensajeDeRechazo(err: ErrorDePago, locale: string): string {
  const l = idioma(locale);
  const codigo = err?.decline_code || err?.code || "";

  if (NO_SE_DICEN.has(codigo)) return GENERICO[l];

  const conocido = MOTIVOS[codigo];
  if (conocido) return conocido[l];
  if (codigo === "generic_decline") return GENERICO[l];

  // Sin código reconocible: lo que dijera Stripe, y si tampoco hay nada, el
  // genérico. Callar es la única opción que no vale.
  return err?.message?.trim() || GENERICO[l];
}

/** ¿Vale la pena que lo vuelva a intentar ya, sin cambiar nada? */
export function mereceReintento(err: ErrorDePago): boolean {
  const codigo = err?.decline_code || err?.code || "";
  return codigo === "try_again_later" || codigo === "processing_error";
}

// Exports para tests: verificar que ningún mensaje se queda sin traducir.
export const _MENSAJES = M;
export const _GENERICO = GENERICO;
export const _LOCALES: Locale[] = ["es", "en", "pt", "fr", "de", "it", "nl", "pl", "el"];
