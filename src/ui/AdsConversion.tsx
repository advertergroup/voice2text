const GADS_LABEL = "AW-18399245321/B8vsCLblo-wcEInouMVE"; // acción "Compra" de Google Ads

/**
 * Fragmento de evento de conversión de Google Ads, como <script> estático
 * (el verificador de Ads solo ve el HTML crudo). Redeclara el stub de gtag
 * porque el layout define el suyo DESPUÉS de {children} en el body; ambos
 * solo hacen push a dataLayer, gtag.js procesa la cola al cargar.
 * transaction_id dedupe: recargar la página no cuenta una segunda conversión.
 */
export function AdsConversion({ value, txid }: { value: number; txid: string }) {
  return (
    <script dangerouslySetInnerHTML={{ __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('event', 'conversion', {
        'send_to': ${JSON.stringify(GADS_LABEL)},
        'value': ${Number(value) || 0},
        'currency': 'USD',
        'transaction_id': ${JSON.stringify(txid)}
      });
    ` }} />
  );
}
