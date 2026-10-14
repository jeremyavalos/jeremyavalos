ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS ip_source TEXT;
