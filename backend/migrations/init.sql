-- Init schema for Challenge Me
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- players table (optional; stores public gamertag linked to a token)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gamertag TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- challenges: best-of-3 match container
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gamertag TEXT NOT NULL,
  player_token_hash TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'chess',
  status TEXT NOT NULL DEFAULT 'open', -- open, completed, cancelled
  player_wins INT NOT NULL DEFAULT 0,
  jeremy_wins INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  current_game_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- games: individual chess games within a challenge
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  fen_start TEXT NOT NULL,
  fen_current TEXT NOT NULL,
  challenger_color TEXT NOT NULL DEFAULT 'white', -- 'white' or 'black' for challenger
  status TEXT NOT NULL DEFAULT 'ongoing', -- ongoing, finished
  result TEXT, -- 'white','black','draw'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- moves: recorded moves for audit / reconstruction
CREATE TABLE IF NOT EXISTS moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  move_number INT NOT NULL,
  uci TEXT NOT NULL,
  san TEXT,
  from_sq TEXT,
  to_sq TEXT,
  piece TEXT,
  fen_after TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  player_side TEXT NOT NULL -- 'white' or 'black'
);

-- add winner column to challenges
ALTER TABLE IF EXISTS challenges ADD COLUMN IF NOT EXISTS winner TEXT;

CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_games_challenge ON games(challenge_id);
CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
