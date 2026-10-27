// Entry point: node server/index.js (serves dist/ and /api on $PORT).

import http from "node:http";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createSearch } from "./search.js";
import { openStore } from "./db/store.js";
import { createDatasetSources, DATASETS } from "./datasets/index.js";
import { createCimaSource } from "./sources/cima.js";
import { createOpenFdaSource } from "./sources/openfda.js";
import { createHealthCanadaSource, healthCanadaMode } from "./sources/healthCanada.js";
import { createAiSources, AI_TIMEOUT_MS } from "./sources/ai.js";
import { createWarmUp } from "./warmup.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const int = (v, d) => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : d);

const version = (() => {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  } catch {
    return "unknown";
  }
})();

// The national datasets live in SQLite. Mount a volume at DATA_DIR to keep them across deploys;
// without one they are downloaded again after each start (a few minutes, in the background).
const dataDir = path.resolve(root, env.DATA_DIR || "data");
const store = (() => {
  try {
    return openStore(path.join(dataDir, "medicines.sqlite"));
  } catch (err) {
    // usually a volume mounted as root while the image runs as `node` (Railway: RAILWAY_RUN_UID=0)
    log(`cannot open the database in ${dataDir}: ${err.message}. The folder must be writable by this user.`);
    process.exit(1);
  }
})();
const deps = { fetch: globalThis.fetch, env };
// Canada: the monthly data extract (always answers), the live API, both, or neither
const canada = healthCanadaMode(env.HEALTH_CANADA, log);
const datasets = createDatasetSources({
  store,
  datasets: DATASETS.filter((d) => d.id !== "health-canada" || canada.dataset),
  // files imported by hand (e.g. Finland's Perusrekisteri.xml) go in DATA_DIR/imports
  importDir: path.join(dataDir, "imports"),
  // keys of the datasets that need one (NHS_TRUD_API_KEY, PBS_API_SUBSCRIPTION_KEY)
  env,
  fetch: globalThis.fetch,
  log,
});

const officialSources = [
  ...datasets.sources,
  createCimaSource(deps),
  ...(canada.live ? [createHealthCanadaSource(deps)] : []),
  // off (and left to the browser) until OPENFDA_API_KEY is set
  createOpenFdaSource(deps),
];
const aiSources = createAiSources(deps);

const search = createSearch({
  sources: officialSources,
  // a brand name ("Nurofen") is searched as its ingredient
  resolve: datasets.resolveBrand,
  cacheTtlMs: int(env.SEARCH_CACHE_SECONDS, 3600) * 1000,
  // answers survive restarts (Railway stops the server when idle): live CIMA and Health Canada calls
  persist: store.answers("search"),
});
const aiSearch = createSearch({
  sources: aiSources,
  // AI answers are slow and cost money: keep them for a day, across restarts too
  cacheTtlMs: int(env.AI_CACHE_SECONDS, 24 * 3600) * 1000,
  persist: store.answers("ai"),
  aiDailyLimit: int(env.AI_DAILY_LIMIT, 500),
  sourceTimeoutMs: AI_TIMEOUT_MS + 5000,
});

const handler = createApp({
  distDir: path.resolve(root, env.DIST_DIR || "dist"),
  search,
  aiSearch,
  sources: [...officialSources, ...aiSources],
  version,
  allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  rateLimit: { limit: int(env.SEARCH_RATE_LIMIT, 20), windowMs: 60e3 },
  aiRateLimit: { limit: int(env.AI_RATE_LIMIT, 10), windowMs: 60e3 },
  globalRateLimit: { limit: int(env.GLOBAL_SEARCH_RATE_LIMIT, 300), windowMs: 60e3 },
  globalAiRateLimit: { limit: int(env.GLOBAL_AI_RATE_LIMIT, 60), windowMs: 60e3 },
  // searched terms are counted (no address) so the most searched can be warmed up each day
  onSearch: (term) => store.countQuery(term.toLowerCase(), Date.now()),
  log,
});

const server = http.createServer(handler);
server.headersTimeout = 20000;
// the slowest answer (AI, up to about 65 s) must fit
server.requestTimeout = 90000;
// longer than Railway's 60 s idle timeout, so the proxy closes idle connections first
server.keepAliveTimeout = 65000;
// well inside Railway's limits (10,000 connections per service, 10,000 requests per connection)
server.maxConnections = 500;
server.maxRequestsPerSocket = 1000;

// A rejected promise or an exception nobody handled: log it and exit, so Railway restarts the
// server (restart policy ON_FAILURE) instead of it running on in an unknown state.
for (const event of ["unhandledRejection", "uncaughtException"]) {
  process.on(event, (err) => {
    log(`${event}: ${err instanceof Error ? err.stack : err}`);
    process.exit(1);
  });
}

// once a day the most searched terms are searched again (server/warmup.js)
const warmUp = createWarmUp({ search, store, terms: int(env.WARM_TERMS, 50), log });

const port = int(env.PORT, 8080);
server.listen(port, () => {
  const ai = aiSources.filter((s) => s.enabled()).map((s) => s.id);
  log(`medicine-finder ${version} listening on :${port}; data in ${dataDir}; AI providers: ${ai.length ? ai.join(", ") : "none (no keys set)"}`);
  // load missing or stale datasets in the background, then check again every hour
  datasets.refreshDue();
  setInterval(() => {
    datasets.refreshDue();
    void warmUp();
  }, 3600e3).unref();
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    log(`${sig} received, closing`);
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
