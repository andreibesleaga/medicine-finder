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
  listed data sources), `X-Frame-Options: DENY`, `nosniff`, HSTS and a referrer policy. The container
  runs as an unprivileged user.
- CI runs `npm audit --audit-level=high`, builds and smoke-tests the Docker image, and weekly runs
  OSV-Scanner and Trivy.

## Known exceptions

| Advisory | Package | Why it is accepted | Review by |
|---|---|---|---|
| GHSA-wrjc-x8rr-h8h6 (moderate) | react-router 6 | Open redirect only through user-supplied paths in `<Link>`/`useNavigate`; all links here are fixed. Fixed only in react-router 7 (major upgrade deferred). | 2027-01-31 |
| GHSA-337j-9hxr-rhxg (moderate) | react-router 6 | Server-side rendering only; this app renders in the browser. Fixed only in react-router 7. | 2027-01-31 |

The same list is in `osv-scanner.toml`.
