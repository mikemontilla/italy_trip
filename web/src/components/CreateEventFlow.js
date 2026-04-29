"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { palette } from "@/lib/theme";
import ErrorBanner from "./ErrorBanner";

const TOTAL_STEPS = 4;

export default function CreateEventFlow() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{
          backgroundColor: palette.terracotta,
          color: "#fff",
          fontWeight: 600,
        }}
        onClick={() => setOpen(true)}
      >
        + Nuevo viaje
      </button>
      {open && <Modal onClose={() => setOpen(false)} />}
    </>
  );
}

function Modal({ onClose }) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const canAdvance =
    (step === 1 && name.trim().length > 0) ||
    step === 2 ||
    step === 3 ||
    step === 4;

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
      const createRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      if (!createRes.ok) throw new Error("No pudimos crear tu evento.");
      const event = await createRes.json();

      if (photo) {
        const form = new FormData();
        form.append("file", photo);
        const photoRes = await fetch(`/api/events/${event.id}/photo`, {
          method: "POST",
          body: form,
        });
        if (!photoRes.ok) throw new Error("El evento se creó, pero la foto falló.");
      }

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
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 26, 32, 0.65)",
        zIndex: 1050,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
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
            <StepName value={name} onChange={setName} onEnter={next} canAdvance={canAdvance} />
          )}
          {step === 2 && (
            <StepDescription value={description} onChange={setDescription} />
          )}
          {step === 3 && (
            <StepPhoto photo={photo} preview={preview} onChange={setPhoto} />
          )}
          {step === 4 && (
            <StepReview name={name} description={description} preview={preview} />
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
              {submitting ? "Creando..." : "¡Crear viaje!"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepName({ value, onChange, onEnter, canAdvance }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Cómo se llama tu viaje?
      </h4>
      <p className="text-muted small mb-3">Ponle un nombre que te emocione.</p>
      <input
        autoFocus
        type="text"
        className="form-control form-control-lg"
        placeholder="Italy Trip 2026"
        value={value}
        maxLength={255}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canAdvance) onEnter();
        }}
      />
    </>
  );
}

function StepDescription({ value, onChange }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        Cuéntanos un poco más
      </h4>
      <p className="text-muted small mb-3">Opcional. Puedes dejarlo en blanco.</p>
      <textarea
        autoFocus
        className="form-control"
        rows={3}
        placeholder="Roma, Florencia y mucha pasta..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  );
}

function StepPhoto({ photo, preview, onChange }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Una foto para recordarlo?
      </h4>
      <p className="text-muted small mb-3">Opcional. JPEG, PNG o WebP. Máximo 5 MB.</p>
      {preview && (
        <div
          className="mb-3 rounded overflow-hidden"
          style={{ aspectRatio: "16 / 9", backgroundColor: palette.warm }}
        >
          <img
            src={preview}
            alt="Previsualización"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <input
        type="file"
        className="form-control"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {photo && (
        <button
          type="button"
          className="btn btn-sm btn-link mt-2 p-0"
          onClick={() => onChange(null)}
        >
          Quitar foto
        </button>
      )}
    </>
  );
}

function StepReview({ name, description, preview }) {
  return (
    <>
      <h4 className="fw-bold mb-1" style={{ color: palette.dark }}>
        ¿Todo bien?
      </h4>
      <p className="text-muted small mb-3">Revisa antes de lanzarlo al mundo.</p>
      {preview && (
        <div
          className="mb-3 rounded overflow-hidden"
          style={{ aspectRatio: "16 / 9", backgroundColor: palette.warm }}
        >
          <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <dl className="mb-0 small">
        <dt className="text-muted fw-normal">Nombre</dt>
        <dd className="fw-semibold mb-2" style={{ color: palette.dark }}>
          {name}
        </dd>
        <dt className="text-muted fw-normal">Descripción</dt>
        <dd className="mb-0" style={{ color: palette.dark }}>
          {description.trim() || <span className="text-muted">—</span>}
        </dd>
      </dl>
    </>
  );
}
