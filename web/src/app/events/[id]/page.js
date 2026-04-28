import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getEventById } from "@/lib/events";
import { listParticipants } from "@/lib/participants";
import { listExpenses } from "@/lib/expenses";
import { listMovements } from "@/lib/movements";
import { calculateEventBalances } from "@/lib/balances";
import EventCodeShare from "@/components/EventCodeShare";
import AddParticipantFlow from "@/components/AddParticipantFlow";
import ExpensesSection from "@/components/ExpensesSection";
import MovementsSection from "@/components/MovementsSection";
import BalanceStatusBar from "@/components/BalanceStatusBar";
import SettlementButton from "@/components/SettlementButton";
import ParticipantsList from "@/components/ParticipantsList";

const PLACEHOLDER = "/placeholders/event.svg";

function hasPendingBalance(balances) {
  return balances.some((b) => Math.round(Number(b.balance) * 100) !== 0);
}

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
  const currentParticipant = participants.find(
    (p) => p.type === "registered" && p.user.id === userId
  );
  const expenses = await listExpenses(eventId, userId);
  const movements = await listMovements(eventId, userId);
  const balances = await calculateEventBalances(eventId, userId);

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

      <BalanceStatusBar balances={balances} />

      {currentIsAdmin && hasPendingBalance(balances) && (
        <div className="mb-4 d-flex justify-content-end">
          <SettlementButton eventId={event.id} />
        </div>
      )}

      <section className="mb-4">
        <EventCodeShare code={event.code} />
      </section>

      <section className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h2 className="h5 fw-bold mb-0" style={{ color: "var(--color-dark-navy)" }}>
            Participantes ({participants.length})
          </h2>
          {currentIsAdmin && <AddParticipantFlow eventId={event.id} />}
        </div>
        <ParticipantsList
          eventId={event.id}
          participants={participants}
          balances={balances}
        />
      </section>

      <div className="mb-5">
        <ExpensesSection
          eventId={event.id}
          initialExpenses={expenses}
          participants={participants}
          currentParticipantId={currentParticipant?.id ?? null}
          isAdmin={currentIsAdmin}
        />
      </div>

      <MovementsSection
        eventId={event.id}
        initialMovements={movements}
        participants={participants}
        isAdmin={currentIsAdmin}
      />
    </div>
  );
}

