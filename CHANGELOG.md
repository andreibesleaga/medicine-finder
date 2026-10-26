# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

## [2.4.0] - 2026-10-26

### Added
- Official data for 19 more countries from the European Medicines Agency's public extract of the
  Article 57 database (89,285 products): Austria, Belgium, Bulgaria, Croatia, Cyprus, Estonia,
  Germany, Greece, Hungary, Iceland, Latvia, Liechtenstein, Luxembourg, Norway, Portugal, Romania,
  Slovakia, Slovenia and the United Kingdom (Northern Ireland). Coverage: the EU and 39 countries.
  Countries with their own register here keep it; the extract's contact columns are never read.
- Brand-name search: a brand ("Nurofen") is answered with its ingredient's brands in every country,
  with a line saying so, and a warning when the same name stands for another ingredient elsewhere.
  `/api/search` returns a `brand` field in that case.
- Downloads at the end of the results: CSV (RFC 4180, UTF-8 with BOM, ISO 3166 country codes) and
  JSON, with each row's source, terms and condition of reuse; AI rows are marked.
- The page address carries the search (`/?q=ibuprofen&country=Germany`); a link runs it, and "Copy
  link to this search" copies it.
- The front page explains coverage, downloads and AI keys; the country list puts countries with
  official data first; the count comes from the loaded sources (`countries` in `/api/sources`).
- A message while the sleeping server wakes up (first search after a pause).
- `/api/sources` carries `countries` and, where the terms set one, `reuse` for each source; each
  source run in `/api/search` carries `homepage`, `terms` and `reuse`, so downloads always name them.
- A source covering several countries returns the chosen country's brands (up to 60), or up to 20
  per country when none is chosen; the same brand in two countries stays two results.

### Changed
- `DATA_FORMAT` 3: every dataset is reloaded once after the deploy to index brand names (old rows
  are served meanwhile).
- docs/DATA-SOURCES.md re-checked on 26 October 2026 world-wide (Hungary's CSV now answers scripts;
  Latvia, Norway, Hong Kong, Malaysia, Brazil reachable with open licences; several registers need
  the agency's consent).

## [2.3.1] - 2026-10-24

### Fixed
- A request whose path is not a valid URL (for example `//[`) answered nothing and stopped the
  server; it now gets HTTP 400.
- Search terms with punctuation (`paracetamol (acetaminophen)`, `St. John's wort`) found nothing in
  the national datasets: terms are now split into words the same way the database indexes them.
- An AI answer skipped by the daily limit was cached for a day, past the daily reset; it is now kept
  for 5 minutes, like failed answers.
- Spain (CIMA): when one of an ingredient's names fails, the others are still shown, and the count
  is CIMA's own total instead of the first page.
- The browser no longer keeps a search in which a source failed, so the next search tries again;
  "New search" now also stops a running AI phase from bringing old results back.
- A newer Finland file uploaded after a failed load is loaded at the next check instead of an hour
  later.

### Data quality
- English ingredient names now also find the national spellings that the word stems miss: 15 new
  name groups (for example acetylsalicylic acid finds Swedish "acetylsalicylsyra", Danish
  "acetylsalicylsyre", Dutch "acetylsalicylzuur" and Italian "acido acetilsalicilico";
  hydrochlorothiazide, sodium and potassium chloride, folic and ascorbic acid, ethinylestradiol,
  morphine, azithromycin and others likewise). Accents in the search term no longer matter.
- One- and two-letter words are matched whole: "vitamin d" finds vitamin D, not every vitamin.
- United States: no homeopathics, medical gases, or generics whose brand is just the generic name
  (87,903 to 45,943 rows); products with a future end-of-marketing date are kept.
- Lithuania: no parallel imports or distribution, and ATC group names are no longer shown as
  ingredients (7,586 to 4,458).
- Denmark: no veterinary products, and substance names with commas stay whole (13,960 to 12,242).
- Czech Republic: no homeopathics or parallel imports; every holder kept; units in lower case.
- Ukraine: short dosage form and strength instead of the pack text; "combinations" no longer an
  ingredient.
- Colombia, Taiwan, Singapore and Malta: brands and substances cut back from dosage form, strength,
  "equivalente" and maker-tag text (one shared helper, `cutProductTitle` in `server/lib/text.js`);
  Taiwan also drops expired licences; duplicate rows dropped.
- EMA: `;`-separated substances joined with " + "; Finland: duplicates dropped, all-caps brands tidied.
- Each dataset is reloaded once after this deploy (`DATA_FORMAT` in `server/datasets/index.js`), so
  the changes apply without waiting for the next refresh.

### Security
- AI providers' messages for key, billing and permission errors (which can quote part of the key)
  are no longer shown to visitors; key-like strings are hidden in other messages.
- National downloads are capped at 300 MB and zip entries at 1 GB unpacked.
- Record links are opened only when they are `http` or `https` addresses.
- `SECURITY.md` and `docs/DEPLOY.md` now say that the app runs as root on Railway (to write the
  volume) and that the per-visitor limits rely on the proxy's `X-Forwarded-For`.

### Changed
- Search answers over 1 KB are gzip-compressed (about ten times smaller).
- AI country names such as "USA", "UK" or "Czechia" are mapped to the app's country list, so the
  country filter and counts include them.
- Removed 41 unused UI component files and the 33 npm packages only they used; one XML entity decoder
  (`decodeXml` in `server/lib/text.js`) instead of four; ingredient synonyms moved to
  `server/lib/synonyms.js`; the outbound User-Agent no longer carries an old version number.
- The dev server's security headers now come from the server's own policy.
- Dependabot proposes same-major updates only, and also watches the Docker base image; Node 22.13 or
  later (`.nvmrc`); tests are left out of the Docker image.

### Tests
- A stubbed-download test for each of the 14 loaders that had none (`loaders.test.js`), data-quality
  tests per loader (`registers`, `europe`, `names`), name-group tests (`synonyms`), unit tests for the rate limiter
  and the cache, and tests for the fixes above (179 tests in all, up from 99).

### Docs
- API states (`unavailable`, `disabled` for a missing imported file), the dataset contract in
  `CONTRIBUTING.md`, Railway sleep and the CI/deploy order in `docs/DEPLOY.md`, `.env.example` AI
  limits, a broken table row in `docs/ARCHITECTURE.md`.

## [2.3.0] - 2026-10-24

### Added
- Nine more official registers, each downloaded into the database: Sweden (Läkemedelsverket,
  13,540 products), Lithuania (VVKT, 7,586), Ukraine (State Register, 12,183), Malta (Medicines
  Authority, 5,448), United States (FDA NDC Directory, 87,903), Colombia (INVIMA, 9,362), Taiwan
  (TFDA, 22,938), Singapore (HSA, 5,511), New Zealand (Pharmac Schedule, funded medicines, 2,361).
- Finland (Fimea, 11,704) from a file imported by hand into `DATA_DIR/imports` (fimea.fi blocks
  scripts); reloaded whenever a newer file is uploaded. Datasets can now be "off" until their
  source is available, and reload when it changes.
- `docs/DATA-SOURCES.md`: every register in use and every other national register checked (about
  60), with how it could be imported and why it is not used yet.
- The Data sources page links each dataset's terms of use.

### Changed
- Ingredient names come in groups (`server/data/synonyms.json`): paracetamol, acetaminophen and the
  Latin American acetaminofén now find each other (Colombia lists paracetamol as acetaminofén).
- Lithuania's download is tried a second time after a 502 from the portal.
- The XLSX reader accepts namespace-prefixed sheets (`<x:row>`), as written by some .NET tools.

## [2.2.0] - 2026-10-24

### Added
- Czech Republic: SÚKL database of medicinal products (monthly open data), 11,881 registered
  products.
- Denmark: Danish Medicines Agency list of authorised medicines (daily), 13,960 products.
- Canada from Health Canada's monthly data extract (11,463 marketed products), so Canada answers
  even when the Health Canada API is down.
- `HEALTH_CANADA` setting: `dataset` (default), `live`, `both` or `off`.
- Railway volume at `/app/data`: the database survives deploys.

### Changed
- The live Health Canada API (now optional, id `health-canada-live`) reports an outage on its side
  as "not available" instead of "failed".
- Railway configuration moved from `railway.json` (read until 1 Dec 2026) to `.railway/railway.ts`.
- The Czech and Canadian files are refreshed weekly (they change monthly); the others daily.

### Fixed
- Architecture doc pointed at a deleted file for the curated lists.
- Page description and README listed the wrong countries; the server now says clearly when its
  data folder is not writable instead of a bare "unable to open database file".

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
