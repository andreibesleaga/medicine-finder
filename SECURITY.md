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

- The app is frontend-only. Any `VITE_*` value is bundled into the public browser
  build — only set keys you are comfortable exposing, or enable the secure
  Supabase Edge Function path (`VITE_USE_SECURE_API=true`). See
  [docs/supabase-security.md](docs/supabase-security.md).
- `.env` is gitignored; never commit real API keys.
