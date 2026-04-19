-- Migration 008: expense_splits
-- Records which participants share the cost of an expense.
-- Division is always equal: each participant owes (expense.amount / number of splits).

CREATE TABLE IF NOT EXISTS expense_splits (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  expense_id           INT UNSIGNED NOT NULL,
  event_participant_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_splits_expense_participant (expense_id, event_participant_id),
  KEY        idx_splits_participant        (event_participant_id),
  CONSTRAINT fk_splits_expense FOREIGN KEY (expense_id)
    REFERENCES expenses (id) ON DELETE CASCADE,
  CONSTRAINT fk_splits_participant FOREIGN KEY (event_participant_id)
    REFERENCES event_participants (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- uq_splits_expense_participant: a participant can only appear once per expense split.
-- idx_splits_participant: used in balance calculation to find all expenses a participant owes.
