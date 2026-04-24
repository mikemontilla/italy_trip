"use client";

import { useEffect, useState } from "react";
import { formatCOP, formatDate } from "@/lib/format";

const palette = {
  dark: "var(--color-dark-navy)",
  warm: "var(--color-warm-gray)",
  red: "var(--color-red)",
};

export default function ExpenseDetailModal({
  eventId,
  expenseId,
  isAdmin,
  currentParticipantId,
  onClose,
  onDeleted,
}) {
  const [expense, setExpense] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/events/${eventId}/expenses/${expenseId}`);
      if (cancelled) return;
      if (res.ok) setExpense(await res.json());
      else setError("No pudimos cargar el gasto.");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, expenseId]);

  async function handleDelete() {
    if (!confirm("¿Eliminar este gasto?")) return;
    setDeleting(true);
    const res = await fetch(`/api/events/${eventId}/expenses/${expenseId}`, {
      method: "DELETE",
    });
    if (res.ok) onDeleted();
    else {
      setError("No pudimos eliminar el gasto.");
      setDeleting(false);
    }
  }

  const canDelete =
    expense &&
    (isAdmin || expense.created_by_event_participant_id === currentParticipantId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="d-flex justify-content-center align-items-center p-3"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 26, 32, 0.65)",
        zIndex: 1050,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3 shadow-lg overflow-hidden w-100"
        style={{ maxWidth: 520 }}
      >
        <div
          className="px-4 py-3 d-flex justify-content-between align-items-center"
          style={{ backgroundColor: palette.dark, color: "#fff" }}
        >
          <span className="fw-semibold">Detalle del gasto</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-close btn-close-white"
            aria-label="Cerrar"
          />
        </div>

        <div className="px-4 py-4">
          {!expense && !error && (
            <div className="text-center text-muted">Cargando...</div>
          )}
          {error && (
            <div
              className="p-2 rounded small"
              style={{ backgroundColor: "rgba(244,44,4,0.1)", color: palette.red }}
            >
              {error}
            </div>
          )}
          {expense && (
            <>
              <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
                {expense.description}
              </h4>
              <div className="text-muted small mb-3">
                {formatDate(expense.expense_date)}
              </div>
              <div
                className="fw-bold mb-4"
                style={{ fontSize: "2rem", color: "var(--color-steel-blue)" }}
              >
                {formatCOP(expense.amount)}
              </div>

              <h6 className="text-muted small text-uppercase mb-2">Pagadores</h6>
              <ul className="list-unstyled mb-4">
                {expense.payers.map((p) => (
                  <li key={p.id} className="d-flex justify-content-between py-1">
                    <span>{p.name}</span>
                    <span className="fw-semibold">{formatCOP(p.amount)}</span>
                  </li>
                ))}
              </ul>

              <h6 className="text-muted small text-uppercase mb-2">
                Comparten el gasto ({expense.splits.length})
              </h6>
              <div className="d-flex flex-wrap gap-2">
                {expense.splits.map((s) => (
                  <span
                    key={s.id}
                    className="badge"
                    style={{ backgroundColor: palette.warm, color: "#fff" }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {canDelete && (
          <div className="px-4 pb-4 d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar gasto"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
