"use client";

import { useId, useState } from "react";
import { palette } from "@/lib/theme";

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className="bg-white border rounded-3 shadow-sm mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-100 d-flex justify-content-between align-items-center bg-transparent border-0 px-3 py-3"
        style={{ cursor: "pointer" }}
      >
        <h2 className="h5 fw-bold mb-0 text-start" style={{ color: palette.dark }}>
          {title}
          {typeof count === "number" && (
            <span className="text-muted fw-normal"> ({count})</span>
          )}
        </h2>
        <span
          aria-hidden="true"
          className="d-inline-block"
          style={{
            transition: "transform 0.2s ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            color: palette.steel,
            fontSize: "1.25rem",
            lineHeight: 1,
          }}
        >
          ›
        </span>
      </button>
      {open && (
        <div id={bodyId} className="px-3 pt-3 pb-3 border-top">
          {children}
        </div>
      )}
    </section>
  );
}
