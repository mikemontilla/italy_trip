"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FinalizationControls({ eventId, status, balances }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const allZero = balances.every((b) => Math.round(Number(b.balance) * 100) === 0);
  const canFinalize = status === "active" && allZero;
  const canReopen = status === "finalized";
  if (!canFinalize && !canReopen) return null;

  async function call(action, confirmText) {
    if (!confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/${action}`, { method: "PATCH" });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "request_failed");
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 d-flex flex-column align-items-end gap-2">
      {canFinalize && (
        <button
          type="button"
          className="btn fw-semibold"
          style={{ backgroundColor: "#198754", color: "#fff" }}
          disabled={busy}
          onClick={() =>
            call("finalize", "¿Finalizar el evento? No se podrán registrar más gastos ni movimientos.")
          }
        >
          {busy ? "Finalizando..." : "Finalizar evento"}
        </button>
      )}
      {canReopen && (
        <button
          type="button"
          className="btn fw-semibold"
          style={{ backgroundColor: "var(--color-steel-blue)", color: "#fff" }}
          disabled={busy}
          onClick={() =>
            call("reopen", "¿Reabrir el evento? Volverá a estar editable.")
          }
        >
          {busy ? "Reabriendo..." : "Reabrir evento"}
        </button>
      )}
      {error && (
        <div className="small" style={{ color: "var(--color-red)" }}>
          No pudimos completar la acción ({error}).
        </div>
      )}
    </div>
  );
}
