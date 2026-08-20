-- Create analytics table for privacy-friendly page view tracking
CREATE TABLE IF NOT EXISTS analytics_events (
  id serial PRIMARY KEY,
  path text NOT NULL,
  referrer text,
  user_agent text,
  device_category text,
  browser_family text,
  country text,
  created_at timestamptz DEFAULT now()
);
