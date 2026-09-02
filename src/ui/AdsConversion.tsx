const GADS_LABEL = "AW-18399245321/B8vsCLblo-wcEInouMVE"; // acción "Compra" de Google Ads

/**
 * Conversión de compra, como <script> estático (el verificador de Ads solo ve
 * el HTML crudo). Dispara DOS eventos bajo el mismo guard:
 *  - "conversion" hacia Google Ads (send_to con label, value numérico, USD,
 *    transaction_id = id del pago → dedupe del lado de Google);
 *  - "purchase" hacia GA4 (la propiedad G-YTTX45XP2F está conectada como
 *    destino de la etiqueta AW; sin send_to el evento llega a ella).
 * Guard localStorage gads_conv_<txid>: un refresco no re-dispara ninguno; si
 * localStorage está bloqueado se dispara igual (transaction_id dedupe en Google).
 * Redeclara el stub de gtag porque el layout define el suyo DESPUÉS de
 * {children} en el body; ambos solo hacen push a dataLayer.
 */
export function AdsConversion({ value, txid, itemId = "unlock-trial", itemName = "Transcription unlock + 7-day trial" }:
  { value: number; txid: string; itemId?: string; itemName?: string }) {
  const v = Number(value) || 0;
  return (
    <script dangerouslySetInnerHTML={{ __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      (function(){
        try {
          var k = 'gads_conv_' + ${JSON.stringify(txid)};
          if (localStorage.getItem(k)) return;
          localStorage.setItem(k, '1');
        } catch (e) { /* sin localStorage: dispara igual */ }
        gtag('event', 'conversion', {
          'send_to': ${JSON.stringify(GADS_LABEL)},
          'value': ${v},
          'currency': 'USD',
          'transaction_id': ${JSON.stringify(txid)}
        });
        gtag('event', 'purchase', {
          'transaction_id': ${JSON.stringify(txid)},
          'value': ${v},
          'currency': 'USD',
          'items': [{ 'item_id': ${JSON.stringify(itemId)}, 'item_name': ${JSON.stringify(itemName)}, 'price': ${v}, 'quantity': 1 }]
        });
      })();
    ` }} />
  );
}
