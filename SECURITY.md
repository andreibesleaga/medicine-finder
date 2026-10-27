# Security Policy

> This is a proof-of-concept / demo, not a production medical service.

## Supported versions

Only the latest `main` is supported.

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories on this
repository. Do not open public issues for undisclosed vulnerabilities.

We aim to acknowledge reports within 7 days and follow a 90-day coordinated
disclosure window.

## Notes

- AI provider keys are server-side variables (Railway or a local `.env`); the browser build contains
  no keys. `.env` files are gitignored and kept out of the Docker image (`.dockerignore`).
- `/api/search` validates input (2–80 safe characters), is rate-limited per visitor with a sliding
  window (`SEARCH_RATE_LIMIT`, default 20/min) and for all visitors together (`GLOBAL_SEARCH_RATE_LIMIT`,
  default 300/min); AI calls are limited the same way (`AI_RATE_LIMIT`, `GLOBAL_AI_RATE_LIMIT`) and capped
  per day (`AI_DAILY_LIMIT`, default 500). Identical searches running at the same time share one
  upstream round. `HEAD` is refused on the search endpoints.
- Pages are served with a Content Security Policy (same-origin scripts, no inline event handlers,
  network access only to the listed data sources), `X-Frame-Options: DENY`, `nosniff`, HSTS, a referrer
  policy, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` (same-origin for pages,
  cross-origin for `/api` and the published files), `Origin-Agent-Cluster` and
  `X-Permitted-Cross-Domain-Policies: none`. These cover helmet's defaults (compared one by one on
  27 Oct 2026); helmet itself is not used, as the server has no npm dependencies. The image runs
  as the unprivileged `node` user. On Railway it runs as root (`RAILWAY_RUN_UID=0`) because Railway
  mounts the data volume as root; this is accepted for the demo: the server has no runtime npm
  dependencies, only `GET` endpoints, and the volume holds public data only.
- Per-visitor limits use `X-Real-IP`, which Railway documents as the client's address, and fall back
  to the first `X-Forwarded-For` entry (which a client can send) and then the socket address; the
  limit for all visitors together caps what forged addresses could still do.
- The server stops after an unhandled rejection or exception (logged), so Railway restarts it. It
  accepts at most 500 connections and 1,000 requests per connection; idle connections close after 65 s.
- Search answers are kept in the database for their cache time (no visitor data); searched terms are
  counted (term, count, last time; no address, no country) for the daily warm-up of the most searched.
- Downloads of national files are capped at 300 MB, and zip entries at 1 GB unpacked.
- AI providers' messages for key, billing or permission errors are never passed to visitors, and
  anything that looks like an API key is hidden in other messages.
- CI runs `npm audit --audit-level=high`, builds and smoke-tests the Docker image, and weekly runs
  OSV-Scanner and Trivy.

## Known exceptions

| Advisory | Package | Why it is accepted | Review by |
|---|---|---|---|
| GHSA-wrjc-x8rr-h8h6 (moderate) | react-router 6 | Open redirect only through user-supplied paths in `<Link>`/`useNavigate`; all links here are fixed. Fixed only in react-router 7 (major upgrade deferred). | 2027-01-31 |
| GHSA-337j-9hxr-rhxg (moderate) | react-router 6 | Server-side rendering only; this app renders in the browser. Fixed only in react-router 7. | 2027-01-31 |

The same list is in `osv-scanner.toml`.
