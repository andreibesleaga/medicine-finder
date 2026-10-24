# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

## [2.1.0] - 2026-10-24

### Added
- SQLite database on the server (built-in `node:sqlite`) with official national data, loaded in the
  background and refreshed daily: EMA, France, **Italy (AIFA), Poland (URPL), Netherlands (CBG),
  Ireland (HPRA), Switzerland (Swissmedic)**; the curated samples moved into it.
- Country and region choice with fallbacks: country, then EU-wide (EU/EEA), then worldwide
  references; same region or all countries when there is no data, with a note. Regions selectable.
- INN/US name pairs (`server/data/synonyms.json`): "acetaminophen" also finds paracetamol, etc.
- Ranking: official first, more reliable references first, single-ingredient before combinations,
  "Listed by N sources" for brands several sources agree on.
- AI suggestions on their own endpoint (`/api/ai`), shown after the official results; reasoning off
  for OpenRouter, 45 s limit, 24 h cache, 10 requests/min per visitor; provider error messages shown.
- Browser cache of the last 50 searches (IndexedDB, 24 h) with "Search again".
- `/llms.txt` summary for AI tools; GPL-3.0-or-later `LICENSE`, `NOTICE.md` (data-source terms, NLM attribution), issue and PR
  templates. 74 tests.

### Changed
- OpenRouter default model `openrouter/free` (the fixed free models were often rate-limited).
- Docker image keeps the database in `/app/data` (`DATA_DIR`); runs as `node`.

## [2.0.0] - 2026-10-24

### Added
- Node search server (`server/`, no runtime dependencies) that serves the app and `/api`
  (`/api/search`, `/api/sources`, `/api/health`); replaces nginx in the Docker image.
- Official data: EMA medicines (EU), France BDPM, Spain CIMA (AEMPS) and Health Canada DPD.
- AI suggestions from OpenAI, Perplexity, DeepSeek and OpenRouter through the server, each enabled
  by its own server variable, with a daily cap; keys no longer reach the browser.
- Data sources page (`/sources`) with each source's live status; `/database` redirects there.
- Per-source search progress, source type labels (official / open reference / curated / AI),
  "also listed by", links to the source record, ClinicalTrials.gov study count.
- `railway.json` (Dockerfile build, health check), `vercel.json` (Vercel off by default, documented
  switch), `.dockerignore`, `osv-scanner.toml`.
- Docs: `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOY.md`; 49 tests (server and app).

### Changed
- RxNorm now returns brand names (related BN concepts); openFDA searches by ingredient instead of
  by brand; Wikidata uses "has active ingredient"; ClinicalTrials.gov uses API v2.
- The static brand lists are kept as "Curated sample" results, no longer labelled as regulator
  data; entries that were only the generic name were removed.
- Vercel Web Analytics loads only when built with `VITE_VERCEL_ANALYTICS=true` (it caused a
  script error on Railway).
- CI: no `--legacy-peer-deps`, Docker build and smoke test, weekly OSV-Scanner and Trivy.
- Package renamed `medicine-finder`, version 2.0.0, Node 22.

### Removed
- Invented results: generated "(Generic)" rows for Australia, Brazil, Japan and China, generated
  EU, WHO and generic-database rows, random country availability and random prices.
- The simulated local database import (fake downloads and sample data).
- Client-side AI calls and all `VITE_*_API_KEY` variables; the Supabase client and edge functions
  (the Supabase project no longer exists); `VITE_USE_SECURE_API`.
- Unused dependencies: zod, @hookform/resolvers, @supabase/supabase-js, @tanstack/react-query,
  @tailwindcss/typography.

### Security
- High-severity advisories fixed (vite 8.3, vitest 4.1.12, source-map-js); postcss-selector-parser
  raised to 7.1.7 by override (identical CSS output). Two moderate react-router 6 advisories remain,
  documented in SECURITY.md.
- `.env` is now gitignored (it was not) and excluded from the Docker image.

## [1.1.0] - 2026-10-02

### Added
- `VITE_USE_SECURE_API` toggle to route AI searches through Supabase Edge Functions
  (keys stay server-side). Defaults to the existing client-side behavior.
- Vitest test suite (`npm test`) for the RxNorm/OpenFDA adapters and the secure-API toggle.
- `typecheck` script (strict TypeScript) and a working `lint` setup.
- CI workflow, Dependabot, governance files, and `docs/supabase-security.md`.
- Medical disclaimer in the README.

### Changed
- `SecureApiWrapper.isSecureApiAvailable()` now reads `VITE_USE_SECURE_API`
  instead of a hardcoded `false` (default behavior unchanged).
- Enabled `strict` TypeScript in `tsconfig.app.json` and fixed the surfaced types.
- Realigned ESLint to v9 and `eslint-plugin-react-hooks` to stable `5.2.0` so
  `npm run lint` works again (was crashing under a mismatched ESLint 10).
- Standardized on `package-lock.json`; removed the conflicting `bun.lockb`.

### Security
- `npm audit fix` applied — 0 known vulnerabilities (no breaking upgrades).
