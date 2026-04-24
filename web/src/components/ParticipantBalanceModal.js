"use client";

import { useEffect, useState } from "react";
import { formatCOP, formatDate } from "@/lib/format";

const palette = {
  dark: "var(--color-dark-navy)",
  steel: "var(--color-steel-blue)",
  terracotta: "var(--color-terracotta)",
  warm: "var(--color-warm-gray)",
  red: "var(--color-red)",
  green: "#198754",
};

const TYPE_LABEL = {
  transfer: "Transferencia",
  loan: "Préstamo",
};

export default function ParticipantBalanceModal({ eventId, participantId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/events/${eventId}/balance/${participantId}`);
      if (cancelled) return;
      if (res.ok) setData(await res.json());
      else setError("No pudimos cargar el balance.");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, participantId]);

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
        style={{ maxWidth: 560 }}
      >
        <div
          className="px-4 py-3 d-flex justify-content-between align-items-center"
          style={{ backgroundColor: palette.dark, color: "#fff" }}
        >
          <span className="fw-semibold">
            {data ? data.participant.name : "Balance"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-close btn-close-white"
            aria-label="Cerrar"
          />
        </div>

        <div className="px-4 py-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {!data && !error && <div className="text-center text-muted">Cargando...</div>}
          {error && (
            <div
              className="p-2 rounded small"
              style={{ backgroundColor: "rgba(244,44,4,0.1)", color: palette.red }}
            >
              {error}
            </div>
          )}
          {data && !showDetail && <Summary data={data} onShowDetail={() => setShowDetail(true)} />}
          {data && showDetail && <Detail data={data} onBack={() => setShowDetail(false)} />}
        </div>
      </div>
    </div>
  );
}

function Summary({ data, onShowDetail }) {
  const balanceCents = Math.round(Number(data.totals.balance) * 100);
  const balanceColor =
    balanceCents > 0 ? palette.green : balanceCents < 0 ? palette.red : palette.warm;

  return (
    <>
      <div className="text-center mb-4">
        <div className="text-muted small text-uppercase mb-1">Balance neto</div>
        <div className="fw-bold" style={{ fontSize: "2rem", color: balanceColor }}>
          {balanceCents > 0 && "+"}
          {balanceCents < 0 && "−"}
          {formatCOP(Math.abs(balanceCents) / 100)}
        </div>
        <div className="small text-muted">
          {balanceCents > 0
            ? "A favor — le deben plata"
            : balanceCents < 0
              ? "En contra — debe plata"
              : "Al día"}
        </div>
      </div>

      <dl className="row mb-3 small">
        <dt className="col-6 text-muted fw-normal">Total pagado</dt>
        <dd className="col-6 text-end fw-semibold" style={{ color: palette.green }}>
          {formatCOP(data.totals.paid)}
        </dd>
        <dt className="col-6 text-muted fw-normal">Total debido</dt>
        <dd className="col-6 text-end fw-semibold" style={{ color: palette.red }}>
          {formatCOP(data.totals.owed)}
        </dd>
        <dt className="col-6 text-muted fw-normal">Total enviado</dt>
        <dd className="col-6 text-end fw-semibold" style={{ color: palette.green }}>
          {formatCOP(data.totals.sent)}
        </dd>
        <dt className="col-6 text-muted fw-normal">Total recibido</dt>
        <dd className="col-6 text-end fw-semibold" style={{ color: palette.red }}>
          {formatCOP(data.totals.received)}
        </dd>
      </dl>

      <button
        type="button"
        className="btn w-100"
        style={{ backgroundColor: palette.steel, color: "#fff", fontWeight: 600 }}
        onClick={onShowDetail}
      >
        Ver detalle
      </button>
    </>
  );
}

function Detail({ data, onBack }) {
  const { paid_expenses, owed_expenses, sent_movements, received_movements } = data.detail;

  return (
    <>
      <button
        type="button"
        className="btn btn-link p-0 mb-3 text-decoration-none"
        style={{ color: palette.steel }}
        onClick={onBack}
      >
        ← Volver al resumen
      </button>

      <DetailGroup
        title="Gastos que pagó"
        color={palette.green}
        items={paid_expenses}
        empty="No ha pagado ningún gasto."
        renderItem={(e) => (
          <>
            <div className="fw-semibold" style={{ color: palette.dark }}>
              {e.description}
            </div>
            <div className="small text-muted">{formatDate(e.expense_date)}</div>
            <div className="fw-bold" style={{ color: palette.green }}>
              +{formatCOP(e.amount_paid)}
            </div>
          </>
        )}
      />

      <DetailGroup
        title="Gastos que le tocan"
        color={palette.red}
        items={owed_expenses}
        empty="No comparte ningún gasto."
        renderItem={(e) => (
          <>
            <div className="fw-semibold" style={{ color: palette.dark }}>
              {e.description}
            </div>
            <div className="small text-muted">{formatDate(e.expense_date)}</div>
            <div className="fw-bold" style={{ color: palette.red }}>
              −{formatCOP(e.share)}
            </div>
          </>
        )}
      />

      <DetailGroup
        title="Movimientos enviados"
        color={palette.green}
        items={sent_movements}
        empty="No ha enviado movimientos."
        renderItem={(m) => (
          <>
            <div className="fw-semibold" style={{ color: palette.dark }}>
              {TYPE_LABEL[m.type]} → {m.other_party_name}
            </div>
            <div className="small text-muted">{formatDate(m.movement_date)}</div>
            <div className="fw-bold" style={{ color: palette.green }}>
              +{formatCOP(m.amount)}
            </div>
          </>
        )}
      />

      <DetailGroup
        title="Movimientos recibidos"
        color={palette.red}
        items={received_movements}
        empty="No ha recibido movimientos."
        renderItem={(m) => (
          <>
            <div className="fw-semibold" style={{ color: palette.dark }}>
              {TYPE_LABEL[m.type]} ← {m.other_party_name}
            </div>
            <div className="small text-muted">{formatDate(m.movement_date)}</div>
            <div className="fw-bold" style={{ color: palette.red }}>
              −{formatCOP(m.amount)}
            </div>
          </>
        )}
      />
    </>
  );
}

function DetailGroup({ title, color, items, empty, renderItem }) {
  return (
    <div className="mb-4">
      <h6 className="text-uppercase small fw-bold mb-2" style={{ color }}>
        {title} ({items.length})
      </h6>
      {items.length === 0 ? (
        <div className="small text-muted">{empty}</div>
      ) : (
        <ul className="list-group">
          {items.map((item, idx) => (
            <li
              key={item.expense_id ?? item.id ?? idx}
              className="list-group-item d-flex justify-content-between align-items-start gap-3"
            >
              <div className="min-w-0 flex-grow-1">{renderItem(item)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
