-- Migration 009: movements
-- Records money transfers and loans between participants within an event.

CREATE TABLE IF NOT EXISTS movements (
  id                            INT UNSIGNED              NOT NULL AUTO_INCREMENT,
  event_id                      INT UNSIGNED              NOT NULL,
  type                          ENUM('transfer','loan')   NOT NULL,
  amount                        DECIMAL(12, 2)            NOT NULL,
  sender_event_participant_id   INT UNSIGNED              NOT NULL,
  recipient_event_participant_id INT UNSIGNED             NOT NULL,
  bank                          VARCHAR(255)              NULL,
  note                          TEXT                      NULL,
  movement_date                 DATE                      NOT NULL,
  created_at                    TIMESTAMP                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movements_event      (event_id),
  KEY idx_movements_sender     (sender_event_participant_id),
  KEY idx_movements_recipient  (recipient_event_participant_id),
  CONSTRAINT fk_movements_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_sender FOREIGN KEY (sender_event_participant_id)
    REFERENCES event_participants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movements_recipient FOREIGN KEY (recipient_event_participant_id)
    REFERENCES event_participants (id) ON DELETE RESTRICT,
  CONSTRAINT chk_movements_different_participants CHECK (
    sender_event_participant_id <> recipient_event_participant_id
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- idx_movements_event: listing all movements for an event is the primary read pattern.
-- idx_movements_sender / idx_movements_recipient: used in balance calculation to sum
--   all money sent or received by a specific participant.
