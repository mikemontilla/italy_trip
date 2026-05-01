"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCOP, formatDate } from "@/lib/format";
import AddExpenseFlow from "./AddExpenseFlow";
import ExpenseDetailModal from "./ExpenseDetailModal";
import { palette } from "@/lib/theme";

function participantName(participant) {
  return participant.type === "registered"
    ? participant.user.name
    : participant.fictitious.name;
}

export default function ExpensesSection({
  eventId,
  initialExpenses,
  participants,
  currentParticipantId,
  isAdmin,
  isFinalized,
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [filter, setFilter] = useState("");
  const [, startTransition] = useTransition();
  const [openDetailId, setOpenDetailId] = useState(null);

  async function handleFilterChange(value) {
    setFilter(value);
    const url = value
      ? `/api/events/${eventId}/expenses?participant=${value}`
      : `/api/events/${eventId}/expenses`;
    const res = await fetch(url);
    if (res.ok) setExpenses(await res.json());
  }

  function handleMutation() {
    startTransition(() => {
      router.refresh();
    });
    handleFilterChange(filter);
  }

  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 className="h5 fw-bold mb-0" style={{ color: palette.dark }}>
          Gastos ({expenses.length})
        </h2>
        {!isFinalized && (
          <AddExpenseFlow
            eventId={eventId}
            participants={participants}
            onCreated={handleMutation}
          />
        )}
      </div>

      <div className="mb-3">
        <label className="form-label small text-muted mb-1">Filtrar por participante</label>
        <select
          className="form-select"
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
        >
          <option value="">Todos</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {participantName(p)}
            </option>
          ))}
        </select>
      </div>

      {expenses.length === 0 ? (
        <div
          className="text-center p-4 rounded-3 text-muted"
          style={{ backgroundColor: "rgba(136, 162, 170, 0.1)" }}
        >
          Aún no hay gastos. ¡Registra el primero!
        </div>
      ) : (
        <ul className="list-group">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-3"
              style={{ cursor: "pointer" }}
              onClick={() => setOpenDetailId(expense.id)}
            >
              <div className="min-w-0 flex-grow-1">
                <div className="fw-semibold text-truncate" style={{ color: palette.dark }}>
                  {expense.description}
                </div>
                <div className="small text-muted">
                  {formatDate(expense.expense_date)}
                </div>
              </div>
              <div className="fw-bold" style={{ color: palette.steel }}>
                {formatCOP(expense.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {openDetailId && (
        <ExpenseDetailModal
          eventId={eventId}
          expenseId={openDetailId}
          isAdmin={isAdmin}
          currentParticipantId={currentParticipantId}
          isFinalized={isFinalized}
          onClose={() => setOpenDetailId(null)}
          onDeleted={() => {
            setOpenDetailId(null);
            handleMutation();
          }}
        />
      )}
    </section>
  );
}
