"use client";

import { useState } from "react";
import { formatCOP } from "@/lib/format";
import ParticipantBalanceModal from "./ParticipantBalanceModal";
import { palette } from "@/lib/theme";

function participantName(p) {
  return p.type === "registered" ? p.user.name : p.fictitious.name;
}

export default function ParticipantsList({ eventId, participants, balances }) {
  const [openPid, setOpenPid] = useState(null);
  const balancesByPid = new Map(balances.map((b) => [b.participant_id, b]));

  return (
    <>
      <div className="list-group">
        {participants.map((p) => (
          <button
            key={p.id}
            type="button"
            className="list-group-item list-group-item-action d-flex align-items-center gap-3 text-start"
            onClick={() => setOpenPid(p.id)}
          >
            <Avatar participant={p} />
            <div className="flex-grow-1 min-w-0">
              <div className="fw-semibold text-truncate" style={{ color: palette.dark }}>
                {participantName(p)}
              </div>
              <BalanceBadge balance={balancesByPid.get(p.id)?.balance ?? "0.00"} />
            </div>
            {p.role === "admin" && (
              <span
                className="badge"
                style={{ backgroundColor: palette.terracotta, color: "#fff" }}
              >
                Admin
              </span>
            )}
          </button>
        ))}
      </div>

      {openPid !== null && (
        <ParticipantBalanceModal
          eventId={eventId}
          participantId={openPid}
          onClose={() => setOpenPid(null)}
        />
      )}
    </>
  );
}

function BalanceBadge({ balance }) {
  const cents = Math.round(Number(balance) * 100);
  if (cents === 0) {
    return <div className="small text-muted">Al día</div>;
  }
  if (cents > 0) {
    return (
      <div className="small fw-semibold" style={{ color: palette.green }}>
        +{formatCOP(cents / 100)} a favor
      </div>
    );
  }
  return (
    <div className="small fw-semibold" style={{ color: "var(--color-red)" }}>
      −{formatCOP(Math.abs(cents) / 100)} en contra
    </div>
  );
}

function Avatar({ participant }) {
  const size = 40;
  const common = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
  };
  if (participant.type === "registered" && participant.user.avatar_url) {
    return (
      <img
        src={participant.user.avatar_url}
        alt=""
        referrerPolicy="no-referrer"
        style={{ ...common, objectFit: "cover" }}
      />
    );
  }
  const initial =
    participant.type === "registered"
      ? participant.user.name?.[0]?.toUpperCase()
      : participant.fictitious.name?.[0]?.toUpperCase();
  return (
    <div
      className="d-flex align-items-center justify-content-center fw-bold"
      style={{ ...common, backgroundColor: palette.steel, color: "#fff" }}
    >
      {initial ?? "?"}
    </div>
  );
}
