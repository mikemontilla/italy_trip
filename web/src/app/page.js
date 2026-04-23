import { auth } from "@/auth";
import { listEventsForUser } from "@/lib/events";
import EventCard from "@/components/EventCard";
import CreateEventFlow from "@/components/CreateEventFlow";
import JoinEventFlow from "@/components/JoinEventFlow";

export default async function HomePage() {
  const session = await auth();
  const events = await listEventsForUser(session.user.dbUserId);

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: "var(--color-dark-navy)" }}>
            ¡Hola, {session.user.name.split(" ")[0]}! 👋
          </h2>
          <p className="text-muted mb-0">
            {events.length === 0
              ? "Tu próxima aventura te está esperando."
              : `Tienes ${events.length} viaje${events.length === 1 ? "" : "s"} en marcha.`}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <JoinEventFlow />
          <CreateEventFlow />
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="row g-4">
          {events.map((event) => (
            <div key={event.id} className="col-12 col-sm-6 col-lg-4">
              <EventCard event={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="text-center p-5 rounded-3"
      style={{ backgroundColor: "rgba(136, 162, 170, 0.1)" }}
    >
      <div className="display-5 mb-2">🗺️</div>
      <p className="mb-0 text-muted">
        Aún no has creado ningún viaje. ¡Dale al botón para empezar!
      </p>
    </div>
  );
}
