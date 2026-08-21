-- Add a random, first-party browser installation identifier to future analytics.
-- Existing analytics and challenges remain NULL and are never backfilled or merged.
ALTER TABLE IF EXISTS analytics_events
  ADD COLUMN IF NOT EXISTS visitor_id UUID;

ALTER TABLE IF EXISTS challenges
  ADD COLUMN IF NOT EXISTS visitor_id UUID;

CREATE INDEX IF NOT EXISTS analytics_events_visitor_id_idx
  ON analytics_events (visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS challenges_visitor_id_idx
  ON challenges (visitor_id)
  WHERE visitor_id IS NOT NULL;
