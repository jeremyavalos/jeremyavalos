-- Add ip column to analytics events for admin-only analytics
ALTER TABLE IF EXISTS analytics_events
  ADD COLUMN IF NOT EXISTS ip inet;

CREATE INDEX IF NOT EXISTS analytics_events_ip_idx ON analytics_events (ip);
