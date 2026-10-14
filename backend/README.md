# Challenge Me Backend

Node.js + Express backend for the "Challenge Me" chess matches.

Main features
- REST API for creating challenges and playing chess moves
- Server-authoritative chess validation using `chess.js`
- PostgreSQL schema and migrations in `migrations/init.sql`
- Minimal admin endpoint protected by `ADMIN_SECRET`

Environment variables
- `DEBUG_IP=1` - log proxy headers, socket IP, Express IP and selected client IP on every request. Disable after diagnosis.
- `TRUSTED_PROXY_CIDRS` - optional comma-separated trusted proxy networks, e.g. `100.64.0.0/10`. Supports IPv4 and IPv6. When configured, forwarding headers are ignored unless the socket peer is trusted; XFF is traversed right-to-left through trusted proxies to the first untrusted hop. This deliberately avoids left-to-right selection, which accepts a spoofed prefix. Empty or invalid configuration warns and trusts no proxies.
- Client IP priority is valid `CF-Connecting-IP`, then XFF, then `X-Real-IP`, then the socket. Without `TRUSTED_PROXY_CIDRS`, the first valid XFF entry is selected for compatibility; this mode is spoofable. Trusted ingress must overwrite CF/real-IP headers and sanitize XFF. Trusting Railway's socket does not prove a CF header came from Cloudflare; only enable trust for controlled ingress and verify its header policy. `ip_source` records the selected input, not proof of identity.
- `DATABASE_URL` - PostgreSQL connection string (Railway provides this)
- `PORT` - (optional) server port (default 4000)
- `CORS_ORIGIN` - allowed origin for frontend (e.g. https://jeremyavalos.vercel.app)
- `ADMIN_SECRET` - secret for admin endpoints
- `PLAYER_TOKEN_SECRET` - secret used to HMAC player tokens
- `PUBLIC_URL` - optional public URL for match link generation (e.g. https://jeremyavalos.vercel.app)
- `IPINFO_TOKEN` - IPinfo access token used only by the backend for approximate visitor geolocation

Installation

1. Install dependencies:

```bash
cd backend
npm install
```

2. Run all pending migrations (requires `DATABASE_URL` set). The analytics table is created before `init.sql` creates its indexes; remaining migrations run in filename order:

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
3. Set the application environment variables in Railway, including `IPINFO_TOKEN` to enable cached approximate visitor geolocation.
4. Start the app — Railway runs `npm start`, which applies pending idempotent migrations before starting the server.

Notes
- Historical proxy cleanup: run `npm run migrate`, then `node scripts/mark_proxy_ips.js --dry-run` to preview, and `node scripts/mark_proxy_ips.js` to apply. Only events with `ip_source IS NULL` and a non-null IP are eligible. An event matches if its IP is in a configured CIDR OR its `ip_geolocation_cache.asn_org` contains `datacamp` (case-insensitive, including expired cache entries). Default CIDRs: `152.233.0.0/16`, `84.17.0.0/16`, `169.150.0.0/16`, `89.222.0.0/16`, `79.127.0.0/16`, `104.28.0.0/16`, `212.102.0.0/16`, `95.173.0.0/16`. `PROXY_LEGACY_CIDRS` replaces only the CIDR list; an empty list leaves organization matching active. Whitespace and duplicate entries are removed; invalid CIDRs fail atomically. Events are marked `proxy_legacy` without changing existing source attribution. Each event is counted once; overlapping CIDRs are attributed to the most specific range, and organization-only matches are reported separately. Repeat runs do not change already marked rows. This is a historical classification heuristic, not recovery of original visitor IPs or proof that an address was a proxy rather than a VPN user. The IP list shows `proxy` only when every event for that IP is marked.
- Device fingerprints use a synchronous 32-bit hash of browser characteristics. They are optional, may collide or change, and never merge Visitor IDs automatically. `GET /api/admin/fingerprint/:fp` requires an admin session and paginates events with `page` and `page_size`.
- Run `npm test` for regression checks. Integration tests require a disposable migrated PostgreSQL instance via `TEST_DATABASE_URL`; run `npm run test:integration`.
- Tokens are returned to the client once on challenge creation. The server stores only a hashed token.
- The frontend must include the Railway API base URL (see `script.js` placeholder `API_BASE` / `window.API_BASE`).
