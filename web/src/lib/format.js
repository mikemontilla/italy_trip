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

export function formatCOP(amount) {
  const num = Number(amount);
  const hasFraction = Math.round(num * 100) % 100 !== 0;
  return (hasFraction ? copFormatterDec : copFormatterInt).format(num);
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
