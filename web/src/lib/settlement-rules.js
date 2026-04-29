// Tolerance for treating an event as fully settled.
// COP has no practical sub-peso transactions, so individual balances within
// ±1 peso (100 cents) are absorbed and the event is considered finalized.
export const SETTLEMENT_TOLERANCE_CENTS = 100;

export function isWithinTolerance(balanceCents) {
  return Math.abs(balanceCents) <= SETTLEMENT_TOLERANCE_CENTS;
}

export function allBalancesSettled(balances) {
  return balances.every((b) => {
    const cents = typeof b.balance_cents === "number"
      ? b.balance_cents
      : Math.round(Number(b.balance) * 100);
    return isWithinTolerance(cents);
  });
}
