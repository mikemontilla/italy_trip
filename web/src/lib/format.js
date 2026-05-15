const copFormatterInt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const copFormatterDec = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric amount as Colombian Pesos.
 *
 * Shows 0 decimal places for integer amounts and 2 decimals when the amount
 * has a fractional part. This keeps the typical COP look clean while still
 * allowing precision when other currencies are used in the future. Accepts
 * numbers or numeric strings (the DB returns DECIMAL as string).
 *
 * @param {number | string} amount - Numeric value in major units (pesos, not cents).
 * @returns {string} - Formatted string with currency symbol.
 *
 * @example
 * formatCOP(50000);    // "$50.000"
 * formatCOP(33.33);    // "$33,33"
 * formatCOP("100.50"); // "$100,50"  (accepts numeric strings from the DB)
 */
export function formatCOP(amount) {
  const num = Number(amount);
  const hasFraction = Math.round(num * 100) % 100 !== 0;
  return (hasFraction ? copFormatterDec : copFormatterInt).format(num);
}

/**
 * Formats an ISO date string as a short, locale-aware Spanish date.
 *
 * @param {string} isoString - Any value accepted by the `Date` constructor
 *   (typically `"YYYY-MM-DD"` or a full ISO 8601 timestamp).
 * @returns {string} - Date formatted with day, abbreviated month, and year.
 *
 * @example
 * formatDate("2026-05-15");           // "15 may 2026"
 * formatDate("2026-12-01T10:30:00Z"); // "01 dic 2026"
 */
export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
