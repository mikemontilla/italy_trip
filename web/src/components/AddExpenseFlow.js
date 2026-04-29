"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCOP } from "@/lib/format";
import { palette } from "@/lib/theme";

const TOTAL_STEPS = 6;

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

export default function AddExpenseFlow({ eventId, participants, onCreated }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ backgroundColor: palette.terracotta, color: "#fff", fontWeight: 600 }}
        onClick={() => setOpen(true)}
      >
        + Nuevo gasto
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
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayIsoDate());
  const [payerIds, setPayerIds] = useState([]);
  const [payerMode, setPayerMode] = useState("equal");
  const [manualAmounts, setManualAmounts] = useState({});
  const [splitIds, setSplitIds] = useState(participants.map((p) => p.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const totalNum = Number(amount);

  const computedPayerAmounts = useMemo(() => {
    if (payerMode === "manual") {
      return payerIds.map((id) => ({
        participantId: id,
        amount: Number(manualAmounts[id] ?? 0),
      }));
    }
    if (payerIds.length === 0 || !Number.isFinite(totalNum)) return [];
    const each = Math.floor((totalNum * 100) / payerIds.length) / 100;
    const remainderCents =
      Math.round(totalNum * 100) - Math.round(each * 100) * payerIds.length;
    return payerIds.map((id, i) => ({
      participantId: id,
      amount: each + (i === 0 ? remainderCents / 100 : 0),
    }));
  }, [payerIds, payerMode, manualAmounts, totalNum]);

  const payerSum = computedPayerAmounts.reduce((acc, p) => acc + p.amount, 0);
  const payersValid =
    payerIds.length > 0 &&
    Math.round(payerSum * 100) === Math.round(totalNum * 100);

  function canAdvance() {
    if (step === 1) return description.trim().length > 0;
    if (step === 2) return Number.isFinite(totalNum) && totalNum > 0;
    if (step === 3) return Boolean(expenseDate);
    if (step === 4) return payersValid;
    if (step === 5) return splitIds.length > 0;
    return true;
  }

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1);
  }
  function back() {
    if (step > 1) setStep(step - 1);
  }

  function togglePayer(id) {
    setPayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function toggleSplit(id) {
    setSplitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: totalNum,
          expense_date: expenseDate,
          payers: computedPayerAmounts.map((p) => ({
            participant_id: p.participantId,
            amount: p.amount,
          })),
          split_participant_ids: splitIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No pudimos registrar el gasto.");
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
          {step === 1 && <StepDescription value={description} onChange={setDescription} />}
          {step === 2 && <StepAmount value={amount} onChange={setAmount} />}
          {step === 3 && <StepDate value={expenseDate} onChange={setExpenseDate} />}
          {step === 4 && (
            <StepPayers
              participants={participants}
              payerIds={payerIds}
              togglePayer={togglePayer}
              payerMode={payerMode}
              setPayerMode={setPayerMode}
              manualAmounts={manualAmounts}
              setManualAmounts={setManualAmounts}
              computedPayerAmounts={computedPayerAmounts}
              total={totalNum}
              payersValid={payersValid}
            />
          )}
          {step === 5 && (
            <StepSplits
              participants={participants}
              splitIds={splitIds}
              toggleSplit={toggleSplit}
            />
          )}
          {step === 6 && (
            <StepReview
              description={description}
              amount={totalNum}
              expenseDate={expenseDate}
              computedPayerAmounts={computedPayerAmounts}
              splitIds={splitIds}
              participants={participants}
            />
          )}

          {error && (
            <div
              className="mt-3 p-2 rounded small"
              style={{ backgroundColor: "rgba(244,44,4,0.1)", color: palette.red }}
            >
              {error}
            </div>
          )}
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
              {submitting ? "Guardando..." : "¡Registrar gasto!"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDescription({ value, onChange }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Qué fue el gasto?
      </h4>
      <p className="text-muted small mb-3">Una descripción corta es suficiente.</p>
      <input
        autoFocus
        type="text"
        className="form-control form-control-lg"
        placeholder="Cena en Roma"
        value={value}
        maxLength={255}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  );
}

function StepAmount({ value, onChange }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Cuánto fue?
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
        ¿Cuándo?
      </h4>
      <p className="text-muted small mb-3">Por defecto usamos la fecha de hoy.</p>
      <input
        type="date"
        className="form-control form-control-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  );
}

function StepPayers({
  participants,
  payerIds,
  togglePayer,
  payerMode,
  setPayerMode,
  manualAmounts,
  setManualAmounts,
  computedPayerAmounts,
  total,
  payersValid,
}) {
  const payerLookup = Object.fromEntries(
    computedPayerAmounts.map((p) => [p.participantId, p.amount])
  );

  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Quién pagó?
      </h4>
      <p className="text-muted small mb-3">Puede ser una o varias personas.</p>
      <div className="mb-3">
        {participants.map((p) => {
          const selected = payerIds.includes(p.id);
          return (
            <div key={p.id} className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id={`payer-${p.id}`}
                checked={selected}
                onChange={() => togglePayer(p.id)}
              />
              <label className="form-check-label" htmlFor={`payer-${p.id}`}>
                {participantName(p)}
              </label>
            </div>
          );
        })}
      </div>

      {payerIds.length > 1 && (
        <>
          <div className="btn-group w-100 mb-3" role="group">
            <button
              type="button"
              className={`btn ${payerMode === "equal" ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setPayerMode("equal")}
            >
              Partes iguales
            </button>
            <button
              type="button"
              className={`btn ${payerMode === "manual" ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setPayerMode("manual")}
            >
              Montos manuales
            </button>
          </div>

          {payerMode === "manual" && (
            <div>
              {payerIds.map((id) => {
                const p = participants.find((pp) => pp.id === id);
                return (
                  <div key={id} className="d-flex align-items-center gap-2 mb-2">
                    <span className="flex-grow-1">{p ? participantName(p) : id}</span>
                    <div className="input-group" style={{ maxWidth: 180 }}>
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control"
                        value={manualAmounts[id] ?? ""}
                        onChange={(e) =>
                          setManualAmounts({ ...manualAmounts, [id]: e.target.value })
                        }
                      />
                    </div>
                  </div>
                );
              })}
              {!payersValid && Number.isFinite(total) && (
                <div
                  className="small"
                  style={{ color: palette.red }}
                >
                  La suma no coincide con el total ({formatCOP(total)}).
                </div>
              )}
            </div>
          )}

          {payerMode === "equal" && Number.isFinite(total) && total > 0 && (
            <div className="small text-muted">
              Cada uno pondrá aproximadamente {formatCOP(total / payerIds.length)}.
            </div>
          )}
        </>
      )}

      {payerIds.length === 1 && Number.isFinite(total) && total > 0 && (
        <div className="small text-muted">
          {participants.find((p) => p.id === payerIds[0])
            ? `${participantName(participants.find((p) => p.id === payerIds[0]))} pondrá ${formatCOP(total)}.`
            : ""}
        </div>
      )}
    </>
  );
}

function StepSplits({ participants, splitIds, toggleSplit }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Entre quiénes se divide?
      </h4>
      <p className="text-muted small mb-3">
        Se divide en partes iguales entre quienes selecciones.
      </p>
      {participants.map((p) => {
        const selected = splitIds.includes(p.id);
        return (
          <div key={p.id} className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id={`split-${p.id}`}
              checked={selected}
              onChange={() => toggleSplit(p.id)}
            />
            <label className="form-check-label" htmlFor={`split-${p.id}`}>
              {participantName(p)}
            </label>
          </div>
        );
      })}
    </>
  );
}

function StepReview({
  description,
  amount,
  expenseDate,
  computedPayerAmounts,
  splitIds,
  participants,
}) {
  const payerLookup = Object.fromEntries(
    participants.map((p) => [p.id, participantName(p)])
  );
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Todo en orden?
      </h4>
      <p className="text-muted small mb-3">Revisa antes de registrar.</p>
      <dl className="mb-0 small">
        <dt className="text-muted fw-normal">Descripción</dt>
        <dd className="fw-semibold mb-2" style={{ color: palette.dark }}>
          {description}
        </dd>
        <dt className="text-muted fw-normal">Monto</dt>
        <dd className="fw-semibold mb-2" style={{ color: palette.dark }}>
          {formatCOP(amount)}
        </dd>
        <dt className="text-muted fw-normal">Fecha</dt>
        <dd className="mb-2" style={{ color: palette.dark }}>
          {expenseDate}
        </dd>
        <dt className="text-muted fw-normal">Pagadores</dt>
        <dd className="mb-2" style={{ color: palette.dark }}>
          <ul className="list-unstyled mb-0">
            {computedPayerAmounts.map((p) => (
              <li key={p.participantId}>
                {payerLookup[p.participantId]} — {formatCOP(p.amount)}
              </li>
            ))}
          </ul>
        </dd>
        <dt className="text-muted fw-normal">Comparten</dt>
        <dd className="mb-0" style={{ color: palette.dark }}>
          {splitIds.map((id) => payerLookup[id]).join(", ")}
        </dd>
      </dl>
    </>
  );
}
