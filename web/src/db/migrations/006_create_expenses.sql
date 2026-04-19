-- Migration 006: expenses
-- A shared expense registered within an event.

CREATE TABLE IF NOT EXISTS expenses (
  id                          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  event_id                    INT UNSIGNED   NOT NULL,
  description                 VARCHAR(255)   NOT NULL,
  amount                      DECIMAL(12, 2) NOT NULL,
  expense_date                DATE           NOT NULL,
  created_by_event_participant_id INT UNSIGNED NOT NULL,
  created_at                  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_event       (event_id),
  KEY idx_expenses_created_by  (created_by_event_participant_id),
  CONSTRAINT fk_expenses_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_created_by FOREIGN KEY (created_by_event_participant_id)
    REFERENCES event_participants (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- idx_expenses_event: the most frequent query is listing all expenses for a given event.
-- idx_expenses_created_by: used when filtering expenses registered by a specific participant.
