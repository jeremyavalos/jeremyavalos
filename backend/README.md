# Portfolio Analytics Backend

Node.js and Express backend for portfolio analytics, visitor and interaction reporting, and voluntary contact capture.

## Features

- First-party visitor IDs, optional device fingerprints, page and section events.
- IP history, IP-source attribution, approximate geolocation, device, operating-system, browser, and network-provider details.
- Private admin dashboard protected by server-side sessions and CSRF validation.
- Returning-visitor context and voluntary lead capture.
- PostgreSQL migrations and integration tests.

Game routes and dashboard components are retired. Existing game schemas and historical records remain in the database; no destructive game-table migration is included.

## Environment

- `DATABASE_URL` — PostgreSQL connection string.
- `PORT` — optional server port (default `4000`).
- `SESSION_SECRET` — strong secret used to sign administrator sessions.
- `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` — admin credentials.
- `CORS_ORIGIN` — allowed frontend origin.
- `BACKEND_PUBLIC_URL` — optional public URL used by CORS.
- `IPINFO_TOKEN` — optional IPinfo token for approximate, cached geolocation.
- `TRUSTED_PROXY_CIDRS` — optional comma-separated trusted proxy networks. Forwarded headers are only trusted from configured proxy peers; XFF is traversed right-to-left to the first untrusted hop.

The analytics API records the selected `ip_source`, which identifies the header or socket used, not a person's identity. IP-derived location is approximate.

## Install and run

```bash
cd backend
npm install
npm run migrate
npm run dev
```

`npm start` applies pending migrations before starting the server. Existing migration files, game tables, visitor IDs, and historical records are retained.

## Endpoints

- `GET /health`
- `POST /api/analytics/track`
- `POST /api/leads`
- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin` — session-protected analytics dashboard.
- `GET /api/admin/overview`
- `GET /api/admin/visitors` and `/api/admin/visitors/:visitorId`
- `GET /api/admin/fingerprint/:fp`
- `GET /api/admin/ips` and `/api/admin/ips/:ip`
- `GET /api/admin/tracking` and `/api/admin/tracking/:ref`

Admin analytics endpoints and dashboard assets require an authenticated admin session.

## Verification

Run local regression checks with:

```bash
npm test
```

PostgreSQL integration tests require a disposable, migrated database configured through `TEST_DATABASE_URL`:

```bash
npm run test:integration
```

## Historical proxy classification

`node scripts/mark_proxy_ips.js --dry-run` previews classification, and `node scripts/mark_proxy_ips.js` applies it to eligible legacy analytics events. It only marks events with a non-null IP and a null source; existing attribution is not overwritten. Classification is a heuristic, not recovery of original visitor IPs or proof that an address belongs to a VPN or proxy.


## Publishing the authenticated analytics gateway

The canonical frontend posts to the Vercel function at `/api/analytics`. The function uses only Vercel's `X-Real-IP` (documented as the same client address Vercel supplies after normalization), never IP fields or alternate address headers from the visitor. Vercel overwrites the forwarded address at its own edge by default. Validate the header behavior in the actual project, including proxy/DNS settings, alternate aliases, IPv4 and IPv6. A VPN contributes its exit address. A proxy in front of Vercel may become the observed address. See the [Vercel request header reference](https://vercel.com/docs/headers/request-headers).

Vercel sends a fresh random nonce and an HMAC-SHA256 over an array containing protocol version, method, exact route, Unix timestamp, nonce, validated IP and SHA-256 of the exact transmitted body. User-Agent and supported low-entropy Client Hints travel in that signed body. Railway verifies the signature in constant time, enforces a 45-second time window, and persists the nonce for two minutes. Replay protection, per-minute network limits, event ID reservation, insert and response storage all use private PostgreSQL. Event IDs retain retry results for 24 hours. A retry with new signature and the same event ID returns the original result; a reused ID with a different payload is rejected. Limits group IPv6 by /64 and never use the network as a visitor or session key. Limits and nonces are purged periodically. The one migration adds only three gateway tables and their indexes.

The browser retries transient failures with the same generated event ID, with up to three attempts. Offline browsers, closed tabs and extended downtime cannot guarantee delivery. An existing `visitor_id` still identifies the same historical browser. The gateway requires the body's ID to match the first-party cookie and binds it with a signed, HttpOnly, Secure, host-only cookie. Legacy UUIDs that have never been bound are installation identifiers, not proof of identity or authentication credentials. Keep them out of public URLs and logs.

### Configuration

| Service | Variable | Purpose |
| --- | --- | --- |
| Vercel and Railway | `ANALYTICS_HMAC_SECRET` | Same server-only random 32-byte key encoded as 64 hex characters. Separate keys for staging and production. |
| Vercel | `ANALYTICS_RAILWAY_ORIGIN` | Fixed HTTPS origin of the approved Railway backend, without a trailing slash. |
| Vercel | `ANALYTICS_PUBLIC_ORIGIN` | Exact HTTPS origin of the frontend. Defaults to `https://www.jeremyavalos.xyz`. Use the actual isolated frontend origin for staging. |
| Railway | `ANALYTICS_REQUIRE_GATEWAY` | Set to `1` only after the frontend cutover to reject unsigned legacy analytics requests. |

Keep `DATABASE_URL`, `IPINFO_TOKEN`, and `SESSION_SECRET` in Railway. Vercel must not have database access. The signed route remains independent of Railway forwarded headers, the legacy proxy CIDRs, and Express trust proxy. `/admin` remains on the Railway domain with the existing one-hop Express HTTPS decision, server-side sessions and CSRF. This preserves production login behavior, but that existing boundary does not distinguish direct private callers for HTTPS or the admin's legacy per-IP limiter. Confirm secure cookies on the actual public Railway path and inventory any nontrusted private service that can reach admin. Review platform log retention separately from application logging; do not enable dumps of request headers or cookies.

### Activation and rollback

1. In isolated staging use separate secrets and private disposable PostgreSQL. Deploy Railway first and check the additive migration, signed and legacy paths, login and Secure cookie. Deploy the Vercel function and frontend to the approved staging domain. Test overwriting caller-provided addresses at the actual Vercel edge, as that boundary is simulated locally. Validate in Chromium and by counts grouped by `ip_source`, without exporting visitor IDs or addresses. Verify availability of a Vercel Firewall rate rule for `POST /api/analytics` and enable it before public activation if available. The application limit is 120 signed requests per minute per IPv4 address or IPv6 /64. Shared networks may hit it together. This limits writes, while a platform rule can also limit function invocations.
2. After approval deploy Railway with the key and `ANALYTICS_REQUIRE_GATEWAY` unset. Confirm the signed endpoint, canonical CORS, legacy tracking, database health and admin login. Deploy the Vercel function and frontend together with the matching secret only after Railway is ready. Use the approved source SHA to build both. Neither client sends the same event to both paths.
3. Observe aggregate counts and gateway error rates during overlap. Confirm the expected change to `vercel-gateway` as the source. After the old browser asset has drained to an accepted threshold, enable `ANALYTICS_REQUIRE_GATEWAY=1` and verify unsigned requests are denied. Previously opened tabs can retain old code indefinitely. Closing the unsigned path trades compatibility with those tabs for authentication. Do not describe the retirement as guaranteed lossless.
4. To roll back, re-enable the legacy endpoint on Railway first, retaining the signed route for still-open new clients. Verify the legacy path in staging and health/admin in production, then restore the approved previous Vercel deployment. Leave the additive tables and all analytics records intact. Keep the signed route until new browser assets have drained, then decide whether to roll Railway back. The rollback temporarily restores the legacy IP and trust behavior; coordinate approval and timing. Rotating the shared key also invalidates signed visitor cookies until they are cleared and rebound. Keep the key stable through this rollout.
