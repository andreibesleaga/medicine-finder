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
- Tests cover the server and the search logic in `src/lib`; the React pages and components have no
  automated tests, so check a change to them in the browser (`npm run build && npm start`).

## Adding a data source

A national dataset is one file in `server/datasets/` exporting `{ id, name, kind, coverage,
countries, homepage, terms, reuse?, refreshMs, load(fetch, ctx) }` (`countries`: the country names
it covers, as in the app's country list; `reuse`: a condition of its terms beyond naming the source,
copied into downloads) where `load` returns rows `{ brand, ingredient,
country, holder?, strength?, form?, status?, url? }`. A file imported by hand also defines
`available(ctx)`, `unavailableDetail` and `modifiedAt(ctx)`, with `ctx.importDir` the imports
folder; see `server/datasets/fimea.js`. Add it to `DATASETS` in `server/datasets/index.js`, with a
parser test in `server/test/datasets.test.js` and a stubbed-download test in
`server/test/loaders.test.js`, its terms in `NOTICE.md` (and a `terms`
link on the dataset), and a row in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md). Only official,
free, publicly downloadable data whose terms allow reuse; that page lists the registers already
checked and why the others are not used.

By contributing you agree that your contribution is licensed under GPL-3.0-or-later.

## Reporting issues

Use GitHub issues for bugs and feature ideas. For security reports, see
[SECURITY.md](SECURITY.md).
