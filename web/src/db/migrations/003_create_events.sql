-- Migration 003: events
-- A group event (trip, outing, etc.) with a unique shareable alphanumeric code.

CREATE TABLE IF NOT EXISTS events (
  id                 INT UNSIGNED               NOT NULL AUTO_INCREMENT,
  code               VARCHAR(8)                 NOT NULL,
  name               VARCHAR(255)               NOT NULL,
  description        TEXT                       NULL,
  photo_path         VARCHAR(512)               NULL,
  status             ENUM('active','finalized') NOT NULL DEFAULT 'active',
  created_by_user_id INT UNSIGNED               NOT NULL,
  created_at         TIMESTAMP                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalized_at       TIMESTAMP                  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_events_code         (code),
  KEY        idx_events_created_by  (created_by_user_id),
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- uq_events_code: events are shared via their code, so lookups by code are frequent.
-- idx_events_created_by: used when listing all events created by a specific user.
