-- Migration 010: track who registered each movement.
-- Needed because movements can be registered by any participant (not only admins),
-- and when viewing a movement's detail the admin must see who registered it
-- before deciding whether to delete it.

ALTER TABLE movements
  ADD COLUMN created_by_event_participant_id INT UNSIGNED NOT NULL AFTER note,
  ADD KEY idx_movements_created_by (created_by_event_participant_id),
  ADD CONSTRAINT fk_movements_created_by
    FOREIGN KEY (created_by_event_participant_id)
    REFERENCES event_participants (id) ON DELETE RESTRICT;

-- Indexes:
-- idx_movements_created_by: supports the JOIN with event_participants / users /
--   fictitious_participants used to display the registrant's name in the movement detail.
