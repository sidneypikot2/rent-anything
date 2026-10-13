// Money is in centavos everywhere in the API (RAA-104); partners type and guests read pesos.

const PESO = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 });
const PESO_CENTS = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

// 120000 → "₱1,200"; 120050 → "₱1,200.50".
export function formatPeso(cents: number) {
  return (cents % 100 === 0 ? PESO : PESO_CENTS).format(cents / 100);
}

// A peso amount as typed ("1200", "1,200.5") → 120050 centavos; null when it isn't one.
export function toCents(text: string): number | null {
  const value = text.replaceAll(",", "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

// 120050 → "1200.50", 120000 → "1200": the value a peso input starts from.
export function fromCents(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
