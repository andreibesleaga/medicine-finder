# Contributing

Thanks for your interest in this demo project.

## Development

```bash
npm install          # the Docker/CI build uses --legacy-peer-deps
npm run dev          # http://localhost:8080
npm run lint
npm run typecheck
npm test
```

## Guidelines

- Keep changes small, simple, and backward compatible — this is a demo.
- Never commit API keys; remember `VITE_*` values ship to the browser.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm audit` before a PR.

## Reporting issues

Use GitHub issues for bugs and feature ideas. For security reports, see
[SECURITY.md](SECURITY.md).
