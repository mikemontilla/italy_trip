-- Migration 002: users
-- Stores authenticated users (Google OAuth only).

CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  google_id  VARCHAR(255)  NOT NULL,
  email      VARCHAR(255)  NOT NULL,
  name       VARCHAR(255)  NOT NULL,
  avatar_url VARCHAR(512)  NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_google_id (google_id),
  UNIQUE KEY uq_users_email     (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes:
-- uq_users_google_id: NextAuth looks up users by Google ID on every login.
-- uq_users_email: ensures no duplicate accounts and supports lookups by email.
