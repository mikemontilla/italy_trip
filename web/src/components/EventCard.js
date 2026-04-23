const PLACEHOLDER = "/placeholders/event.svg";

export default function EventCard({ event }) {
  const photo = event.photo_path || PLACEHOLDER;
  return (
    <div className="card h-100 shadow-sm border-0 overflow-hidden">
      <div style={{ aspectRatio: "16 / 9", backgroundColor: "var(--color-warm-gray)" }}>
        <img
          src={photo}
          alt={event.name}
          className="w-100 h-100"
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
          <h5 className="card-title mb-0" style={{ color: "var(--color-dark-navy)" }}>
            {event.name}
          </h5>
          <span
            className="badge font-monospace"
            style={{
              backgroundColor: "var(--color-steel-blue)",
              fontSize: "0.75rem",
            }}
          >
            {event.code}
          </span>
        </div>
        {event.description && (
          <p className="card-text text-muted small mb-0">{event.description}</p>
        )}
      </div>
    </div>
  );
}
