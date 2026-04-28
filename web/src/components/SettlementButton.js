"use client";

import { useState } from "react";
import SettlementModal from "./SettlementModal";

export default function SettlementButton({ eventId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn fw-semibold"
        style={{ backgroundColor: "var(--color-terracotta)", color: "#fff" }}
        onClick={() => setOpen(true)}
      >
        Sugerir cruce de cuentas
      </button>
      {open && <SettlementModal eventId={eventId} onClose={() => setOpen(false)} />}
    </>
  );
}
