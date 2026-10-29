# Contributing

Thanks for your interest in this demo project.

## Development

Node 22.13 or later (`engines` in `package.json`; `.nvmrc` pins 22).

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
countries, homepage, terms, reuse?, requires?, refreshMs, load(fetch, ctx) }` (`countries`: the country names
it covers, as in the app's country list; `reuse`: a condition of its terms beyond naming the source,
copied into downloads; `requires`: the name of a server variable that holds a key, the dataset
stays off until it is set) where `load` returns rows `{ brand, ingredient,
country, holder?, strength?, form?, status?, url? }`. A file imported by hand also defines
`available(ctx)`, `unavailableDetail` and `modifiedAt(ctx)`, with `ctx.importDir` the imports
folder; see `server/datasets/fimea.js`. Add it to `DATASETS` in `server/datasets/index.js`, with a
parser test in `server/test/datasets.test.js` and a stubbed-download test in
`server/test/loaders.test.js`, its terms in `NOTICE.md` (and a `terms`
link on the dataset), and a row in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md). Only official,
free, publicly downloadable data whose terms allow reuse; that page lists the registers already
checked and why the others are not used.

By contributing you agree that your contribution is licensed under GPL-3.0-or-later.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`, every Monday at 06:00 UTC and
by hand. Its jobs:

- `build-test`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
  `npm audit --audit-level=high`, then a CycloneDX SBOM kept as the `sbom` artifact.
- `docker`: builds the image, starts it, and checks `/api/health`, the app and `/sources`, a `400`
  for an invalid search term and the content type of `/.well-known/sustainability-data`.
- `security-scan` (Monday and manual runs only): OSV-Scanner on `package-lock.json` and a Trivy
  scan. OSV-Scanner's accepted advisories are in `osv-scanner.toml` and [SECURITY.md](SECURITY.md).

A red `npm run lint`, `typecheck`, `test` or `build` step in `build-test` can be reproduced by running
that script locally. Railway deploys every push
to `main` without waiting for CI (see [docs/DEPLOY.md](docs/DEPLOY.md)).

## Releasing

1. Set the new version in `package.json` and `package-lock.json` (`/api/health` reports it) and in
   the example in [docs/API.md](docs/API.md).
2. Move the entries of `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) under the new version and date.
3. Merge to `main` through a pull request once CI is green; Railway deploys it.
4. Tag the merge commit `vX.Y.Z` (for example `v2.5.1`) and push the tag.

## Translations

The interface strings are in `src/i18n/locales/<language>.json` (English in `en.json` is the
source). A new language: copy `en.json`, translate the values (keep every `{placeholder}`; give each
plural form the language needs, as `Intl.PluralRules` lists them: `key_one`, `key_few`, …), add the
language to `LANGUAGES` in `src/i18n/core.tsx` and an `hreflang` link in `index.html`; `npm test`
checks keys, placeholders and plural forms. Set `"_meta.status"` to `"reviewed"` only after a fluent
speaker has read the file. Register data is never translated.

## Other names of an ingredient

Hand-made groups are in `server/data/synonyms.json`. `server/data/unii-synonyms.json` is generated
from the FDA's UNII names list: download https://precision.fda.gov/uniisearch/archive/latest/UNIIs.zip,
then `node scripts/build-unii-synonyms.mjs path/to/UNII_Names_<date>.txt`, review the diff, run
`npm test`.

## Reporting issues

Use GitHub issues for bugs and feature ideas. For security reports, see
[SECURITY.md](SECURITY.md).
