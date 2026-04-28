"use client";

import { useEffect, useState } from "react";
import { formatCOP } from "@/lib/format";

const palette = {
  dark:       "var(--color-dark-navy)",
  steel:      "var(--color-steel-blue)",
  terracotta: "var(--color-terracotta)",
  warm:       "var(--color-warm-gray)",
  red:        "var(--color-red)",
  green:      "#198754",
};

const OPTION_LABEL = {
  option1: "Saldar grandes primero",
  option2: "Liberar pequeños primero",
};

const OPTION_DESCRIPTION = {
  option1: "Empieza por las deudas más grandes contra los acreedores más grandes.",
  option2: "Le da prioridad a sacar a los acreedores chiquitos del juego.",
};

export default function SettlementModal({ eventId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState("option1");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/events/${eventId}/settlement`);
      if (cancelled) return;
      if (res.ok) setData(await res.json());
      else setError("No pudimos calcular el cruce de cuentas.");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const current = data?.[active];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center p-3"
      style={{ backgroundColor: "rgba(15, 26, 32, 0.65)", zIndex: 1050 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3 shadow-lg overflow-hidden w-100"
        style={{ maxWidth: 640 }}
      >
        <div
          className="px-4 py-3 d-flex justify-content-between align-items-center"
          style={{ backgroundColor: palette.dark, color: "#fff" }}
        >
          <span className="fw-semibold">Cruce de cuentas</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-close btn-close-white"
            aria-label="Cerrar"
          />
        </div>

        <div className="px-4 py-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {!data && !error && <div className="text-center text-muted">Calculando...</div>}
          {error && (
            <div
              className="p-2 rounded small"
              style={{ backgroundColor: "rgba(244,44,4,0.1)", color: palette.red }}
            >
              {error}
            </div>
          )}

          {data && (
            <>
              <ul className="nav nav-pills mb-3 gap-2">
                {["option1", "option2"].map((key) => (
                  <li className="nav-item" key={key}>
                    <button
                      type="button"
                      className={`nav-link ${active === key ? "active" : ""}`}
                      style={
                        active === key
                          ? { backgroundColor: palette.steel, color: "#fff" }
                          : { color: palette.steel }
                      }
                      onClick={() => setActive(key)}
                    >
                      {OPTION_LABEL[key]}
                    </button>
                  </li>
                ))}
              </ul>

              <p className="small text-muted mb-3">{OPTION_DESCRIPTION[active]}</p>

              <Stats stats={current.stats} />

              {current.transfers.length === 0 ? (
                <div
                  className="p-3 rounded text-center fw-semibold"
                  style={{ backgroundColor: "rgba(40,167,69,0.12)", color: palette.green }}
                >
                  ¡Todo cuadrado! No hace falta mover plata.
                </div>
              ) : (
                <ul className="list-group">
                  {current.transfers.map((t, idx) => (
                    <li
                      key={idx}
                      className="list-group-item d-flex justify-content-between align-items-center gap-3"
                    >
                      <div className="min-w-0">
                        <span className="fw-semibold" style={{ color: palette.red }}>
                          {t.from_name}
                        </span>
                        <span className="mx-2" style={{ color: palette.warm }}>
                          →
                        </span>
                        <span className="fw-semibold" style={{ color: palette.green }}>
                          {t.to_name}
                        </span>
                      </div>
                      <span className="fw-bold" style={{ color: palette.dark }}>
                        {formatCOP(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stats({ stats }) {
  return (
    <div className="d-flex gap-3 mb-3 small text-muted">
      <div>
        <span className="fw-semibold" style={{ color: palette.dark }}>
          {stats.transfer_count}
        </span>{" "}
        transferencia{stats.transfer_count === 1 ? "" : "s"}
      </div>
      <div>
        Máx. por persona:{" "}
        <span className="fw-semibold" style={{ color: palette.dark }}>
          {stats.max_transfers_per_participant}
        </span>
      </div>
    </div>
  );
}
