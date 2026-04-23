"use client";

import { useState } from "react";

export default function EventCodeShare({ code }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="p-3 rounded-3 d-flex justify-content-between align-items-center gap-3 flex-wrap"
      style={{ backgroundColor: "rgba(136, 162, 170, 0.15)" }}
    >
      <div>
        <div className="small text-muted mb-1">Compártelo con tus compañeros de viaje</div>
        <div
          className="fw-bold font-monospace"
          style={{ fontSize: "1.75rem", letterSpacing: "0.25rem", color: "var(--color-dark-navy)" }}
        >
          {code}
        </div>
      </div>
      <button
        type="button"
        className="btn"
        style={{ backgroundColor: "var(--color-steel-blue)", color: "#fff", fontWeight: 600 }}
        onClick={handleCopy}
      >
        {copied ? "¡Copiado!" : "Copiar código"}
      </button>
    </div>
  );
}
