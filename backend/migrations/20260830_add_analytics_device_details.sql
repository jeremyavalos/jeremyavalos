-- Human-readable attributes parsed only from each event's standard User-Agent.
-- Historical rows remain NULL because missing detail cannot be reconstructed safely.
ALTER TABLE IF EXISTS analytics_events
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS operating_system TEXT,
  ADD COLUMN IF NOT EXISTS operating_system_version TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS browser_version TEXT;
