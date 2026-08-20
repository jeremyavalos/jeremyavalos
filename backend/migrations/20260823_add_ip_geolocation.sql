ALTER TABLE IF EXISTS analytics_events
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS asn_org TEXT;

CREATE TABLE IF NOT EXISTS ip_geolocation_cache (
  ip INET PRIMARY KEY,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  asn_org TEXT,
  status TEXT NOT NULL DEFAULT 'resolved',
  looked_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ip_geolocation_cache_expires_idx
  ON ip_geolocation_cache (expires_at);
