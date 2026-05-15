/**
 * Tolerance (in cents) under which a participant's balance is treated as
 * effectively zero for the purpose of marking an event as settled.
 *
 * 100 cents = 1 peso. COP has no practical sub-peso transactions, so balances
 * within ±1 peso are absorbed (per SR-36). This avoids blocking event
 * finalization over a 1-cent rounding residue.
 *
 * @type {number}
 */
export const SETTLEMENT_TOLERANCE_CENTS = 100;

/**
 * Checks whether a balance in cents is within the settlement tolerance.
 *
 * @param {number} balanceCents - Integer cents (positive or negative).
 *   This expects cents, not pesos: `100` means 1 peso, not 100 pesos.
 * @returns {boolean} - `true` if `|balanceCents| <= SETTLEMENT_TOLERANCE_CENTS`.
 *
 * @example
 * isWithinTolerance(0);     // true
 * isWithinTolerance(1);     // true   (1 cent)
 * isWithinTolerance(-99);   // true
 * isWithinTolerance(100);   // true   (boundary is inclusive)
 * isWithinTolerance(101);   // false  (just over 1 peso)
 */
export function isWithinTolerance(balanceCents) {
  return Math.abs(balanceCents) <= SETTLEMENT_TOLERANCE_CENTS;
}

/**
 * Returns `true` if every participant's balance is within the settlement
 * tolerance, meaning the event qualifies to be finalized.
 *
 * The input may come from either the server (where balances are integer
 * cents under `balance_cents`) or the client (where the API delivers
 * `balance` as a string from MySQL's DECIMAL serialization). The function
 * normalizes both forms so the same rule can be reused on both sides.
 *
 * @param {Array<{balance_cents?: number, balance?: string | number}>} balances
 *   - Array of balance records. Each entry must provide either
 *   `balance_cents` (preferred, server-side) or `balance` (client-side).
 * @returns {boolean} - `true` when all entries are within tolerance, or
 *   when the array is empty.
 */
export function allBalancesSettled(balances) {
  return balances.every((b) => {
    const cents = typeof b.balance_cents === "number"
      ? b.balance_cents
      : Math.round(Number(b.balance) * 100);
    return isWithinTolerance(cents);
  });
}
