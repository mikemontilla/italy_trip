import { formatCOP } from "@/lib/format";
import { allBalancesSettled } from "@/lib/settlement-rules";

export default function BalanceStatusBar({ balances }) {
  const totalPendingCents = balances
    .map((b) => Math.round(Number(b.balance) * 100))
    .filter((c) => c > 0)
    .reduce((a, b) => a + b, 0);

  const settled = allBalancesSettled(balances);

  return (
    <div
      className="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2"
      style={{
        backgroundColor: settled ? "rgba(40,167,69,0.12)" : "rgba(226,133,110,0.15)",
        border: `1px solid ${settled ? "rgba(40,167,69,0.4)" : "var(--color-terracotta)"}`,
      }}
    >
      <div>
        <div
          className="fw-bold"
          style={{ color: settled ? "var(--color-success-green)" : "var(--color-terracotta)" }}
        >
          {settled ? "¡Todo saldado! 🎉" : "Aún hay cuentas por saldar"}
        </div>
        {!settled && (
          <div className="small text-muted">
            Total por mover: {formatCOP(totalPendingCents / 100)}
          </div>
        )}
      </div>
    </div>
  );
}
