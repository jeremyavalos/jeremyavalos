ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

CREATE INDEX IF NOT EXISTS analytics_events_fingerprint_idx
  ON analytics_events (fingerprint)
  WHERE fingerprint IS NOT NULL;
