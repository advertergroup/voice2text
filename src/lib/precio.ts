import { formatPrice } from "./locale.ts";

/**
 * Precio por idioma. Los países de la campaña (ES/IT/DE) y el resto de locales
 * europeos cobran en EUR; el inglés (EE. UU.) en USD. Importes iguales en ambas
 * monedas (0,99 hoy · 49,99/mes). Fuente ÚNICA de la que salen landing, muro de
 * pago y checkout, para que nunca haya un importe distinto en dos pantallas.
 *
 * ⚠️ Override por geolocalización (un americano en /es → USD) NO implementado:
 * el hosting no pasa cabecera de país; requiere una fuente geoip aparte.
 */
export const TRIPWIRE_CENTS = Number(process.env.TRIPWIRE_CENTS || 99);
export const MONTHLY_CENTS = Number(process.env.MONTHLY_CENTS || 4999);

export type Moneda = "EUR" | "USD";

export function monedaPorLocale(locale: string): Moneda {
  return locale === "en" ? "USD" : "EUR";
}

/** El price recurrente de Stripe según la moneda del cobro de hoy. */
export function stripePriceId(currency: string): string | undefined {
  return currency.toUpperCase() === "EUR" ? process.env.STRIPE_PRICE_EUR : process.env.STRIPE_PRICE_USD;
}

/** Todo lo que necesitan landing/checkout/conversión, derivado del locale. */
export function precioPara(locale: string, tripwireOverride?: number) {
  const currency = monedaPorLocale(locale);
  const trialCents = Number.isFinite(tripwireOverride as number) ? (tripwireOverride as number) : TRIPWIRE_CENTS;
  return {
    currency,
    trialCents,
    monthlyCents: MONTHLY_CENTS,
    todayLabel: formatPrice(trialCents, currency),
    monthlyLabel: formatPrice(MONTHLY_CENTS, currency),
    valueUnits: trialCents / 100, // para el evento de conversión (value + currency)
  };
}
