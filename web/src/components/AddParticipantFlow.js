"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { palette } from "@/lib/theme";
import ErrorBanner from "./ErrorBanner";

const TOTAL_STEPS = 2;

export default function AddParticipantFlow({ eventId }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ backgroundColor: palette.terracotta, color: "#fff", fontWeight: 600 }}
        onClick={() => setOpen(true)}
      >
        + Agregar participante
      </button>
      {open && <Modal eventId={eventId} onClose={() => setOpen(false)} />}
    </>
  );
}

function Modal({ eventId, onClose }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canAdvance = step === 1 ? name.trim().length > 0 : true;

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
      const res = await fetch(`/api/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fictitious", name: name.trim() }),
      });
      if (!res.ok) throw new Error("No pudimos agregar al participante.");
      router.refresh();
      onClose();
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
        style={{ maxWidth: 480 }}
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
          {step === 1 && (
            <>
              <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
                ¿Quién se suma al viaje?
              </h4>
              <p className="text-muted small mb-3">
                Esta persona no necesita tener cuenta — solo un nombre para registrar los gastos.
              </p>
              <input
                autoFocus
                type="text"
                className="form-control form-control-lg"
                placeholder="Nombre del participante"
                value={name}
                maxLength={255}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAdvance) next();
                }}
              />
            </>
          )}
          {step === 2 && (
            <>
              <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
                ¿Todo listo?
              </h4>
              <p className="text-muted small mb-3">Vas a agregar a:</p>
              <div
                className="p-3 rounded-3 fw-semibold"
                style={{ backgroundColor: "rgba(136, 162, 170, 0.15)", color: palette.dark }}
              >
                {name.trim()}
              </div>
            </>
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
              disabled={!canAdvance}
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
              {submitting ? "Agregando..." : "Agregar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
