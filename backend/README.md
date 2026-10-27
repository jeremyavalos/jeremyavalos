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
- `DEBUG_IP=1` — temporarily log request IP selection details during diagnosis.

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
