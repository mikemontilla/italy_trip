"use client";

import { useState } from "react";
import { formatCOP } from "@/lib/format";
import { palette } from "@/lib/theme";
import ErrorBanner from "./ErrorBanner";
import { translateError } from "@/lib/error-messages";

const TOTAL_STEPS = 6;

const TYPE_LABEL = {
  transfer: "Transferencia",
  loan: "Préstamo",
};

function participantName(p) {
  return p.type === "registered" ? p.user.name : p.fictitious.name;
}

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AddMovementFlow({ eventId, participants, onCreated }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ backgroundColor: palette.terracotta, color: "#fff", fontWeight: 600 }}
        onClick={() => setOpen(true)}
      >
        + Nuevo movimiento
      </button>
      {open && (
        <Modal
          eventId={eventId}
          participants={participants}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            onCreated();
          }}
        />
      )}
    </>
  );
}

function Modal({ eventId, participants, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState(null);
  const [senderId, setSenderId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [movementDate, setMovementDate] = useState(todayIsoDate());
  const [bank, setBank] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const totalNum = Number(amount);
  const sameSenderRecipient =
    senderId !== "" && recipientId !== "" && Number(senderId) === Number(recipientId);

  function canAdvance() {
    if (step === 1) return type !== null;
    if (step === 2) return senderId !== "" && recipientId !== "" && !sameSenderRecipient;
    if (step === 3) return Number.isFinite(totalNum) && totalNum > 0;
    if (step === 4) return Boolean(movementDate);
    if (step === 5) return true;
    return true;
  }

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1);
  }
  function back() {
    if (step > 1) setStep(step - 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          sender_participant_id: Number(senderId),
          recipient_participant_id: Number(recipientId),
          amount: totalNum,
          movement_date: movementDate,
          bank: bank.trim() || null,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(translateError(err.error, "No pudimos registrar el movimiento."));
      }
      onCreated();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
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
          <span className="small" style={{ color: palette.warm }}>
            Paso {step} de {TOTAL_STEPS}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-close btn-close-white"
            aria-label="Cerrar"
          />
        </div>

        <div className="px-4 py-4">
          {step === 1 && <StepType type={type} setType={setType} />}
          {step === 2 && (
            <StepParticipants
              participants={participants}
              senderId={senderId}
              setSenderId={setSenderId}
              recipientId={recipientId}
              setRecipientId={setRecipientId}
              sameSenderRecipient={sameSenderRecipient}
            />
          )}
          {step === 3 && <StepAmount value={amount} onChange={setAmount} />}
          {step === 4 && <StepDate value={movementDate} onChange={setMovementDate} />}
          {step === 5 && (
            <StepExtras bank={bank} setBank={setBank} note={note} setNote={setNote} />
          )}
          {step === 6 && (
            <StepReview
              type={type}
              participants={participants}
              senderId={senderId}
              recipientId={recipientId}
              amount={totalNum}
              movementDate={movementDate}
              bank={bank}
              note={note}
            />
          )}

          <ErrorBanner message={error} className="mt-3" />
        </div>

        <div className="px-4 pb-4 d-flex justify-content-between gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={back}
            disabled={step === 1 || submitting}
          >
            Atrás
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              className="btn"
              style={{ backgroundColor: palette.terracotta, color: "#fff", fontWeight: 600 }}
              onClick={next}
              disabled={!canAdvance()}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ backgroundColor: palette.terracotta, color: "#fff", fontWeight: 600 }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Guardando..." : "¡Registrar movimiento!"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepType({ type, setType }) {
  const options = [
    { value: "transfer", label: "Transferencia", desc: "Pago para saldar una deuda" },
    { value: "loan", label: "Préstamo", desc: "Una persona le presta plata a otra" },
  ];
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Qué tipo de movimiento es?
      </h4>
      <p className="text-muted small mb-3">Elige uno.</p>
      <div className="d-flex flex-column gap-2">
        {options.map((opt) => {
          const selected = type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className="btn text-start p-3"
              style={{
                border: `2px solid ${selected ? palette.terracotta : palette.warm}`,
                backgroundColor: selected ? "rgba(226, 133, 110, 0.1)" : "transparent",
              }}
            >
              <div className="fw-semibold" style={{ color: palette.dark }}>
                {opt.label}
              </div>
              <div className="small text-muted">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepParticipants({
  participants,
  senderId,
  setSenderId,
  recipientId,
  setRecipientId,
  sameSenderRecipient,
}) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Entre quiénes?
      </h4>
      <p className="text-muted small mb-3">Quién envía y quién recibe.</p>
      <div className="mb-3">
        <label className="form-label small text-muted">De</label>
        <select
          className="form-select"
          value={senderId}
          onChange={(e) => setSenderId(e.target.value)}
        >
          <option value="">Selecciona...</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {participantName(p)}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label small text-muted">Para</label>
        <select
          className="form-select"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
        >
          <option value="">Selecciona...</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {participantName(p)}
            </option>
          ))}
        </select>
      </div>
      {sameSenderRecipient && (
        <div className="small" style={{ color: palette.red }}>
          El remitente y el destinatario no pueden ser la misma persona.
        </div>
      )}
    </>
  );
}

function StepAmount({ value, onChange }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Cuánto?
      </h4>
      <p className="text-muted small mb-3">En pesos colombianos (COP).</p>
      <div className="input-group input-group-lg">
        <span className="input-group-text">$</span>
        <input
          autoFocus
          type="number"
          min="1"
          step="1"
          className="form-control"
          placeholder="50000"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {Number(value) > 0 && (
        <div className="small text-muted mt-2">{formatCOP(value)}</div>
      )}
    </>
  );
}

function StepDate({ value, onChange }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Cuándo fue?
      </h4>
      <p className="text-muted small mb-3">Por defecto, la fecha de hoy.</p>
      <input
        type="date"
        className="form-control form-control-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  );
}

function StepExtras({ bank, setBank, note, setNote }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        Detalles extra
      </h4>
      <p className="text-muted small mb-3">Opcional. Puedes dejarlo en blanco.</p>
      <div className="mb-3">
        <label className="form-label small text-muted">Banco o plataforma</label>
        <input
          type="text"
          className="form-control"
          placeholder="Nequi, Bancolombia..."
          maxLength={255}
          value={bank}
          onChange={(e) => setBank(e.target.value)}
        />
      </div>
      <div>
        <label className="form-label small text-muted">Nota</label>
        <textarea
          className="form-control"
          rows={3}
          placeholder="Cualquier detalle útil..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </>
  );
}

function StepReview({
  type,
  participants,
  senderId,
  recipientId,
  amount,
  movementDate,
  bank,
  note,
}) {
  const lookup = Object.fromEntries(participants.map((p) => [p.id, participantName(p)]));
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Todo en orden?
      </h4>
      <p className="text-muted small mb-3">Revisa antes de registrar.</p>
      <dl className="mb-0 small">
        <dt className="text-muted fw-normal">Tipo</dt>
        <dd className="fw-semibold mb-2" style={{ color: palette.dark }}>
          {TYPE_LABEL[type]}
        </dd>
        <dt className="text-muted fw-normal">De</dt>
        <dd className="fw-semibold mb-2" style={{ color: palette.dark }}>
          {lookup[Number(senderId)]}
        </dd>
        <dt className="text-muted fw-normal">Para</dt>
        <dd className="fw-semibold mb-2" style={{ color: palette.dark }}>
          {lookup[Number(recipientId)]}
        </dd>
        <dt className="text-muted fw-normal">Monto</dt>
        <dd className="fw-semibold mb-2" style={{ color: palette.dark }}>
          {formatCOP(amount)}
        </dd>
        <dt className="text-muted fw-normal">Fecha</dt>
        <dd className="mb-2" style={{ color: palette.dark }}>
          {movementDate}
        </dd>
        {bank.trim() && (
          <>
            <dt className="text-muted fw-normal">Banco</dt>
            <dd className="mb-2" style={{ color: palette.dark }}>
              {bank}
            </dd>
          </>
        )}
        {note.trim() && (
          <>
            <dt className="text-muted fw-normal">Nota</dt>
            <dd className="mb-0" style={{ color: palette.dark, whiteSpace: "pre-wrap" }}>
              {note}
            </dd>
          </>
        )}
      </dl>
    </>
  );
}
