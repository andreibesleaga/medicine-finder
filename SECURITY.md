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
- `/api/search` validates input (2–80 safe characters), is rate-limited per visitor
  (`SEARCH_RATE_LIMIT`, default 20/min) and AI calls are capped per day (`AI_DAILY_LIMIT`, default 500).
- Pages are served with a Content Security Policy (same-origin scripts, network access only to the
  listed data sources), `X-Frame-Options: DENY`, `nosniff`, HSTS and a referrer policy. The image runs
  as the unprivileged `node` user. On Railway it runs as root (`RAILWAY_RUN_UID=0`) because Railway
  mounts the data volume as root; this is accepted for the demo: the server has no runtime npm
  dependencies, only `GET` endpoints, and the volume holds public data only.
- Per-visitor limits trust the first `X-Forwarded-For` address, which Railway's proxy sets; behind no
  proxy that header can be forged (see [docs/DEPLOY.md](docs/DEPLOY.md#variables)).
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
