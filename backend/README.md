# Challenge Me Backend

Node.js + Express backend for the "Challenge Me" chess matches.

Main features
- REST API for creating challenges and playing chess moves
- Server-authoritative chess validation using `chess.js`
- PostgreSQL schema and migrations in `migrations/init.sql`
- Minimal admin endpoint protected by `ADMIN_SECRET`

Environment variables
- `DATABASE_URL` - PostgreSQL connection string (Railway provides this)
- `PORT` - (optional) server port (default 4000)
- `CORS_ORIGIN` - allowed origin for frontend (e.g. https://jeremyavalos.vercel.app)
- `ADMIN_SECRET` - secret for admin endpoints
- `PLAYER_TOKEN_SECRET` - secret used to HMAC player tokens
- `PUBLIC_URL` - optional public URL for match link generation (e.g. https://jeremyavalos.vercel.app)

Installation

1. Install dependencies:

```bash
cd backend
npm install
```

2. Run migrations (requires `psql` and `DATABASE_URL` set):

```bash
npm run migrate
```

Development

Start server locally (ensure `DATABASE_URL` is set):

```bash
npm run dev
```

Health

GET /health

API endpoints (summary)
- POST /api/challenges — create a new challenge (returns match URL + token)
- GET /api/challenges/:id — get challenge metadata
- GET /api/challenges/:id/games/current — get current game for a challenge
- POST /api/games/:id/moves — submit a move (server validates)
- GET /api/leaderboard — public leaderboard by gamertag
- GET /admin/challenges — admin list (requires `x-admin-secret` header)

Deployment on Railway

1. Create a new Project and add the PostgreSQL plugin.
2. Add the repository or upload these files.
3. Set environment variables in Railway: `DATABASE_URL`, `ADMIN_SECRET`, `PLAYER_TOKEN_SECRET`, `CORS_ORIGIN`, and `PUBLIC_URL`.
4. Start the app — Railway runs `npm start`, which applies pending idempotent migrations before starting the server.

Notes
- Tokens are returned to the client once on challenge creation. The server stores only a hashed token.
- The frontend must include the Railway API base URL (see `script.js` placeholder `API_BASE` / `window.API_BASE`).
