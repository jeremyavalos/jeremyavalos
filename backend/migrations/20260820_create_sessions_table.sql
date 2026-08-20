-- Create sessions table for connect-pg-simple
CREATE TABLE IF NOT EXISTS session (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
