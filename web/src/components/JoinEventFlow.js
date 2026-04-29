"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { palette } from "@/lib/theme";

const CODE_PATTERN = /^[A-Z0-9]{8}$/;

export default function JoinEventFlow() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{
          backgroundColor: "transparent",
          color: palette.steel,
          border: `2px solid ${palette.steel}`,
          fontWeight: 600,
        }}
        onClick={() => setOpen(true)}
      >
        Unirme con código
      </button>
      {open && <Modal onClose={() => setOpen(false)} />}
    </>
  );
}

function Modal({ onClose }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const normalized = code.trim().toUpperCase();
  const canSubmit = CODE_PATTERN.test(normalized);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/events/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      if (res.status === 404) throw new Error("Ese código no corresponde a ningún viaje.");
      if (!res.ok) throw new Error("No pudimos unirte al viaje.");
      const event = await res.json();
      router.push(`/events/${event.id}`);
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
        style={{ maxWidth: 420 }}
      >
        <div
          className="px-4 py-3 d-flex justify-content-between align-items-center"
          style={{ backgroundColor: palette.dark, color: "#fff" }}
        >
          <span className="fw-semibold">Unirme a un viaje</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-close btn-close-white"
            aria-label="Cerrar"
          />
        </div>

        <div className="px-4 py-4">
          <p className="text-muted small mb-3">Pega el código de 8 caracteres que te compartieron.</p>
          <input
            autoFocus
            type="text"
            className="form-control form-control-lg font-monospace text-uppercase"
            placeholder="A1B2C3D4"
            value={code}
            maxLength={8}
            style={{ letterSpacing: "0.25rem", textAlign: "center" }}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) handleSubmit();
            }}
          />

          {error && (
            <div
              className="mt-3 p-2 rounded small"
              style={{ backgroundColor: "rgba(244,44,4,0.1)", color: palette.red }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: palette.steel, color: "#fff", fontWeight: 600 }}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Uniendo..." : "Unirme"}
          </button>
        </div>
      </div>
    </div>
  );
}
