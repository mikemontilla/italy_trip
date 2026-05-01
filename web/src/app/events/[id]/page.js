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
import FinalizationControls from "@/components/FinalizationControls";
import ParticipantsList from "@/components/ParticipantsList";
import CollapsibleSection from "@/components/CollapsibleSection";
import { allBalancesSettled } from "@/lib/settlement-rules";

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
  const currentParticipant = participants.find(
    (p) => p.type === "registered" && p.user.id === userId
  );
  const expenses = await listExpenses(eventId, userId);
  const movements = await listMovements(eventId, userId);
  const balances = await calculateEventBalances(eventId, userId);
  const isFinalized = event.status === "finalized";

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
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
            <h1 className="fw-bold mb-0" style={{ color: "var(--color-dark-navy)" }}>
              {event.name}
            </h1>
            {isFinalized && (
              <span
                className="badge"
                style={{ backgroundColor: "var(--color-dark-navy)", color: "#fff" }}
              >
                Finalizado
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-muted mb-0">{event.description}</p>
          )}
        </div>
      </div>

      <BalanceStatusBar balances={balances} />

      {currentIsAdmin && !isFinalized && !allBalancesSettled(balances) && (
        <div className="mb-4 d-flex justify-content-end">
          <SettlementButton eventId={event.id} />
        </div>
      )}

      {currentIsAdmin && (
        <FinalizationControls
          eventId={event.id}
          status={event.status}
          balances={balances}
        />
      )}

      <section className="mb-4">
        <EventCodeShare code={event.code} />
      </section>

      <CollapsibleSection title="Participantes" count={participants.length}>
        {currentIsAdmin && !isFinalized && (
          <div className="d-flex justify-content-end mb-3">
            <AddParticipantFlow eventId={event.id} />
          </div>
        )}
        <ParticipantsList
          eventId={event.id}
          participants={participants}
          balances={balances}
        />
      </CollapsibleSection>

      <ExpensesSection
        eventId={event.id}
        initialExpenses={expenses}
        participants={participants}
        currentParticipantId={currentParticipant?.id ?? null}
        isAdmin={currentIsAdmin}
        isFinalized={isFinalized}
      />

      <MovementsSection
        eventId={event.id}
        initialMovements={movements}
        participants={participants}
        isAdmin={currentIsAdmin}
        isFinalized={isFinalized}
      />
    </div>
  );
}

