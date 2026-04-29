"use client";

import { useEffect, useState } from "react";
import { formatCOP, formatDate } from "@/lib/format";
import { palette } from "@/lib/theme";
import ErrorBanner from "./ErrorBanner";

const TYPE_LABEL = {
  transfer: "Transferencia",
  loan: "Préstamo",
};

export default function MovementDetailModal({
  eventId,
  movementId,
  isAdmin,
  isFinalized,
  onClose,
  onDeleted,
}) {
  const [movement, setMovement] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/events/${eventId}/movements/${movementId}`);
      if (cancelled) return;
      if (res.ok) setMovement(await res.json());
      else setError("No pudimos cargar el movimiento.");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, movementId]);

  async function handleDelete() {
    if (!confirm("¿Eliminar este movimiento?")) return;
    setDeleting(true);
    const res = await fetch(`/api/events/${eventId}/movements/${movementId}`, {
      method: "DELETE",
    });
    if (res.ok) onDeleted();
    else {
      setError("No pudimos eliminar el movimiento.");
      setDeleting(false);
    }
  }

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
          <span className="fw-semibold">Detalle del movimiento</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-close btn-close-white"
            aria-label="Cerrar"
          />
        </div>

        <div className="px-4 py-4">
          {!movement && !error && (
            <div className="text-center text-muted">Cargando...</div>
          )}
          <ErrorBanner message={error} />
          {movement && (
            <>
              <div className="d-flex align-items-center gap-2 mb-3">
                <span
                  className="badge"
                  style={{
                    backgroundColor:
                      movement.type === "loan" ? palette.terracotta : palette.steel,
                    color: "#fff",
                  }}
                >
                  {TYPE_LABEL[movement.type]}
                </span>
                <span className="small text-muted">{formatDate(movement.movement_date)}</span>
              </div>

              <div
                className="fw-bold mb-4"
                style={{ fontSize: "2rem", color: palette.steel }}
              >
                {formatCOP(movement.amount)}
              </div>

              <div className="d-flex align-items-center gap-2 mb-4">
                <span className="fw-semibold" style={{ color: palette.dark }}>
                  {movement.sender.name}
                </span>
                <span className="text-muted">→</span>
                <span className="fw-semibold" style={{ color: palette.dark }}>
                  {movement.recipient.name}
                </span>
              </div>

              {movement.bank && (
                <div className="mb-2">
                  <div className="text-muted small text-uppercase">Banco</div>
                  <div style={{ color: palette.dark }}>{movement.bank}</div>
                </div>
              )}

              {movement.note && (
                <div className="mb-2">
                  <div className="text-muted small text-uppercase">Nota</div>
                  <div style={{ color: palette.dark, whiteSpace: "pre-wrap" }}>
                    {movement.note}
                  </div>
                </div>
              )}

              <div
                className="mt-4 pt-3 small text-muted border-top"
              >
                Registrado por{" "}
                <span className="fw-semibold" style={{ color: palette.dark }}>
                  {movement.created_by.name}
                </span>
              </div>
            </>
          )}
        </div>

        {isAdmin && !isFinalized && movement && (
          <div className="px-4 pb-4 d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar movimiento"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
