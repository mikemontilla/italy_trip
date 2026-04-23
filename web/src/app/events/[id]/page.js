import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getEventById } from "@/lib/events";
import { listParticipants } from "@/lib/participants";
import EventCodeShare from "@/components/EventCodeShare";
import AddParticipantFlow from "@/components/AddParticipantFlow";

const PLACEHOLDER = "/placeholders/event.svg";

export default async function EventDetailPage({ params }) {
  const { id } = await params;
  const eventId = Number.parseInt(id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const session = await auth();
  const userId = session.user.dbUserId;

  const event = await getEventById(eventId, userId);
  if (!event) notFound();

  const participants = await listParticipants(eventId, userId);
  const currentIsAdmin = participants.some(
    (p) => p.type === "registered" && p.user.id === userId && p.role === "admin"
  );

  return (
    <div className="container py-4">
      <Link
        href="/"
        className="small text-decoration-none mb-3 d-inline-block"
        style={{ color: "var(--color-steel-blue)" }}
      >
        ← Volver a mis viajes
      </Link>

      <div className="card border-0 shadow-sm overflow-hidden mb-4">
        <div
          style={{ aspectRatio: "16 / 5", backgroundColor: "var(--color-warm-gray)" }}
        >
          <img
            src={event.photo_path || PLACEHOLDER}
            alt={event.name}
            className="w-100 h-100"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="card-body">
          <h1 className="fw-bold mb-2" style={{ color: "var(--color-dark-navy)" }}>
            {event.name}
          </h1>
          {event.description && (
            <p className="text-muted mb-0">{event.description}</p>
          )}
        </div>
      </div>

      <section className="mb-4">
        <EventCodeShare code={event.code} />
      </section>

      <section>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h2 className="h5 fw-bold mb-0" style={{ color: "var(--color-dark-navy)" }}>
            Participantes ({participants.length})
          </h2>
          {currentIsAdmin && <AddParticipantFlow eventId={event.id} />}
        </div>
        <div className="list-group">
          {participants.map((p) => (
            <ParticipantRow key={p.id} participant={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ParticipantRow({ participant }) {
  const isAdmin = participant.role === "admin";
  const name =
    participant.type === "registered" ? participant.user.name : participant.fictitious.name;
  const sublabel =
    participant.type === "registered" ? participant.user.email : "Participante ficticio";

  return (
    <div className="list-group-item d-flex align-items-center gap-3">
      <Avatar participant={participant} />
      <div className="flex-grow-1 min-w-0">
        <div className="fw-semibold text-truncate" style={{ color: "var(--color-dark-navy)" }}>
          {name}
        </div>
        <div className="small text-muted text-truncate">{sublabel}</div>
      </div>
      {isAdmin && (
        <span
          className="badge"
          style={{ backgroundColor: "var(--color-terracotta)", color: "#fff" }}
        >
          Admin
        </span>
      )}
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
      style={{
        ...common,
        backgroundColor: "var(--color-steel-blue)",
        color: "#fff",
      }}
    >
      {initial ?? "?"}
    </div>
  );
}
