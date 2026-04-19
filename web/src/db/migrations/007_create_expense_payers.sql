-- Migration 007: expense_payers
-- Records which participants paid for an expense and how much each one contributed.
-- Supports multiple payers per expense (amounts must sum to the total expense amount).

CREATE TABLE IF NOT EXISTS expense_payers (
  id                   INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  expense_id           INT UNSIGNED   NOT NULL,
  event_participant_id INT UNSIGNED   NOT NULL,
  amount               DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payers_expense_participant (expense_id, event_participant_id),
  KEY idx_payers_participant               (event_participant_id),
  CONSTRAINT fk_payers_expense FOREIGN KEY (expense_id)
    REFERENCES expenses (id) ON DELETE CASCADE,
  CONSTRAINT fk_payers_participant FOREIGN KEY (event_participant_id)
    REFERENCES event_participants (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- uq_payers_expense_participant: a participant can only appear once as payer per expense.
-- idx_payers_participant: used in balance calculation to sum all amounts paid by a participant.
