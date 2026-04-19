-- Migration 005: event_participants
-- Central bridge table. Each row represents one person inside one specific event.
-- Either user_id or fictitious_participant_id must be set, never both, never neither.

CREATE TABLE IF NOT EXISTS event_participants (
  id                       INT UNSIGNED                NOT NULL AUTO_INCREMENT,
  event_id                 INT UNSIGNED                NOT NULL,
  user_id                  INT UNSIGNED                NULL,
  fictitious_participant_id INT UNSIGNED               NULL,
  role                     ENUM('admin','participant') NOT NULL DEFAULT 'participant',
  joined_at                TIMESTAMP                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ep_event_user        (event_id, user_id),
  UNIQUE KEY uq_ep_event_fictitious  (event_id, fictitious_participant_id),
  KEY        idx_ep_user             (user_id),
  CONSTRAINT fk_ep_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_ep_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ep_fictitious FOREIGN KEY (fictitious_participant_id)
    REFERENCES fictitious_participants (id) ON DELETE CASCADE,
  CONSTRAINT chk_ep_one_participant CHECK (
    (user_id IS NOT NULL AND fictitious_participant_id IS NULL) OR
    (user_id IS NULL AND fictitious_participant_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- uq_ep_event_user / uq_ep_event_fictitious: prevents adding the same person twice to the same event.
-- idx_ep_user: used when fetching all events a registered user participates in.
