-- Associate newly created challenges with the trusted request IP for private admin analytics.
ALTER TABLE IF EXISTS challenges
  ADD COLUMN IF NOT EXISTS created_ip inet;

CREATE INDEX IF NOT EXISTS challenges_created_ip_idx
  ON challenges (created_ip)
  WHERE created_ip IS NOT NULL;
