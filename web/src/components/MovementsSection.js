"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCOP, formatDate } from "@/lib/format";
import AddMovementFlow from "./AddMovementFlow";
import MovementDetailModal from "./MovementDetailModal";
import CollapsibleSection from "./CollapsibleSection";
import { palette } from "@/lib/theme";

const TYPE_LABEL = {
  transfer: "Transferencia",
  loan: "Préstamo",
};

export default function MovementsSection({
  eventId,
  initialMovements,
  participants,
  isAdmin,
  isFinalized,
}) {
  const router = useRouter();
  const [movements, setMovements] = useState(initialMovements);
  const [, startTransition] = useTransition();
  const [openDetailId, setOpenDetailId] = useState(null);

  async function refetch() {
    const res = await fetch(`/api/events/${eventId}/movements`);
    if (res.ok) setMovements(await res.json());
  }

  function handleMutation() {
    startTransition(() => {
      router.refresh();
    });
    refetch();
  }

  return (
    <CollapsibleSection title="Movimientos" count={movements.length}>
      {!isFinalized && (
        <div className="d-flex justify-content-end mb-3">
          <AddMovementFlow
            eventId={eventId}
            participants={participants}
            onCreated={handleMutation}
          />
        </div>
      )}

      {movements.length === 0 ? (
        <div
          className="text-center p-4 rounded-3 text-muted"
          style={{ backgroundColor: "rgba(136, 162, 170, 0.1)" }}
        >
          Aún no hay movimientos. Cuando alguien preste o transfiera plata, aparece aquí.
        </div>
      ) : (
        <ul className="list-group">
          {movements.map((m) => (
            <li
              key={m.id}
              className="list-group-item list-group-item-action"
              style={{ cursor: "pointer" }}
              onClick={() => setOpenDetailId(m.id)}
            >
              <div className="d-flex justify-content-between align-items-center gap-3">
                <div className="min-w-0 flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          m.type === "loan" ? palette.terracotta : palette.steel,
                        color: "#fff",
                      }}
                    >
                      {TYPE_LABEL[m.type]}
                    </span>
                    <span className="small text-muted">{formatDate(m.movement_date)}</span>
                  </div>
                  <div className="text-truncate" style={{ color: palette.dark }}>
                    <span className="fw-semibold">{m.sender.name}</span>
                    <span className="text-muted mx-2">→</span>
                    <span className="fw-semibold">{m.recipient.name}</span>
                  </div>
                </div>
                <div className="fw-bold" style={{ color: palette.steel }}>
                  {formatCOP(m.amount)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {openDetailId && (
        <MovementDetailModal
          eventId={eventId}
          movementId={openDetailId}
          isAdmin={isAdmin}
          isFinalized={isFinalized}
          onClose={() => setOpenDetailId(null)}
          onDeleted={() => {
            setOpenDetailId(null);
            handleMutation();
          }}
        />
      )}
    </CollapsibleSection>
  );
}
