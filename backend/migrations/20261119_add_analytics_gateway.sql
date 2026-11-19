CREATE TABLE IF NOT EXISTS analytics_gateway_nonces (
  nonce text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_gateway_nonce_expiry ON analytics_gateway_nonces (expires_at);

CREATE TABLE IF NOT EXISTS analytics_gateway_events (
  event_key uuid PRIMARY KEY,
  payload_hash text NOT NULL,
  event_id bigint,
  response jsonb,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX IF NOT EXISTS analytics_gateway_event_expiry ON analytics_gateway_events (expires_at);

CREATE TABLE IF NOT EXISTS analytics_gateway_limits (
  bucket text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  hits integer NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_gateway_limit_expiry ON analytics_gateway_limits (expires_at);
