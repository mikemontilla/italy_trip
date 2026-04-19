-- Migration 001: create migrations tracking table
-- This table records which migrations have already been applied.

CREATE TABLE IF NOT EXISTS migrations (
  id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255)    NOT NULL,
  applied_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_migrations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
