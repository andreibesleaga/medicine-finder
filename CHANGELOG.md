# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

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
