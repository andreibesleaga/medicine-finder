# Contributing

Thanks for your interest in this demo project.

## Development

```bash
npm ci
npm run dev          # app only, http://localhost:8080
npm run build && npm start   # app + /api
npm run lint
npm run typecheck
npm test
```

## Guidelines

- Keep changes small, simple, and backward compatible — this is a demo.
- Never commit API keys. Keys are server variables; anything named `VITE_*` ships to the browser,
  so never put a secret in one.
- Never add generated or invented data: every result must come from a named source.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm audit` before a PR.

## Reporting issues

Use GitHub issues for bugs and feature ideas. For security reports, see
[SECURITY.md](SECURITY.md).
