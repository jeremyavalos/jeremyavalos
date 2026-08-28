ALTER TABLE IF EXISTS analytics_events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'page_view',
  ADD COLUMN IF NOT EXISTS section_name TEXT;

CREATE INDEX IF NOT EXISTS analytics_events_visitor_created_idx
  ON analytics_events (visitor_id, created_at)
  WHERE visitor_id IS NOT NULL;
