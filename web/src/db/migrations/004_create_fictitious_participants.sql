-- Migration 004: fictitious_participants
-- Guest participants with no account, scoped to a specific event.

CREATE TABLE IF NOT EXISTS fictitious_participants (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id   INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fictitious_participants_event (event_id),
  CONSTRAINT fk_fictitious_participants_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- idx_fictitious_participants_event: fetching all fictitious participants for an event is a common operation.
