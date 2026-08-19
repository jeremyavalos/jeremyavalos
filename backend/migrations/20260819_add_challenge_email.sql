-- Add optional challenger email to challenges
ALTER TABLE IF EXISTS challenges
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill: keep empty (no-op)
DO $$ BEGIN END $$;
