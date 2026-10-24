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

## Adding a data source

A national dataset is one file in `server/datasets/` exporting `{ id, name, kind, coverage,
homepage, refreshMs, load(fetch) }` where `load` returns rows `{ brand, ingredient, country,
holder?, strength?, form?, status?, url? }`; add it to `DATASETS` in `server/datasets/index.js`,
with a parser test in `server/test/datasets.test.js`, its terms in `NOTICE.md` (and a `terms`
link on the dataset), and a row in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md). Only official,
free, publicly downloadable data whose terms allow reuse; that page lists the registers already
checked and why the others are not used.

By contributing you agree that your contribution is licensed under GPL-3.0-or-later.

## Reporting issues

Use GitHub issues for bugs and feature ideas. For security reports, see
[SECURITY.md](SECURITY.md).
