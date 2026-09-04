CREATE TABLE IF NOT EXISTS visitor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'returning_visitor_popup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_leads_visitor_id_idx ON visitor_leads(visitor_id);
