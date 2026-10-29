# Guide for developers and AI coding assistants

Medicine Brand Finder: type an active ingredient, get its brand names in other countries, each
labelled with the source it came from. React app (`src/`) + Node server (`server/`) in one Docker
image. User docs: [README.md](README.md). Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
API: [docs/API.md](docs/API.md). Deploy: [docs/DEPLOY.md](docs/DEPLOY.md).

## Commands

```bash
npm ci                 # install (Node 22.13+)
npm run dev            # app only on :8080 (no /api)
npm run build && npm start   # app + /api on :8080; datasets load into data/ in ~3 min
npm test               # all tests (Vitest), no network
npm run lint && npm run typecheck
```

## Where things are

The file map is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Tests: `server/test/` (server)
and `tests/` (app).

## Rules

1. Never invent data. Every result comes from a named source and keeps its `kind`:
   `official`, `reference`, `curated` or `ai`. No fallback rows, no random values.
2. Keys stay on the server (environment variables). Nothing secret in `VITE_*` variables.
3. Tests do not use the network: stub `fetch` (see `server/test/helpers.js`, `tests/helpers.ts`)
   and use fixed clocks.
4. A new source follows [CONTRIBUTING.md](CONTRIBUTING.md), section "Adding a data source" (parser
   test, `NOTICE.md` entry, README source table, and the other steps listed there).
5. Same-major dependency updates only; exceptions are listed in `SECURITY.md`.
