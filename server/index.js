// Entry point: node server/index.js (serves dist/ and /api on $PORT).

import http from "node:http";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createSearch } from "./search.js";
import { openStore } from "./db/store.js";
import { createDatasetSources } from "./datasets/index.js";
import { createCimaSource } from "./sources/cima.js";
import { createHealthCanadaSource } from "./sources/healthCanada.js";
import { createAiSources, AI_TIMEOUT_MS } from "./sources/ai.js";

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
const store = openStore(path.join(dataDir, "medicines.sqlite"));
const deps = { fetch: globalThis.fetch, env };
const datasets = createDatasetSources({ store, fetch: globalThis.fetch, log });

const officialSources = [...datasets.sources, createCimaSource(deps), createHealthCanadaSource(deps)];
const aiSources = createAiSources(deps);

const search = createSearch({
  sources: officialSources,
  cacheTtlMs: int(env.SEARCH_CACHE_SECONDS, 3600) * 1000,
});
const aiSearch = createSearch({
  sources: aiSources,
  // AI answers are slow and cost money: keep them for a day
  cacheTtlMs: int(env.AI_CACHE_SECONDS, 24 * 3600) * 1000,
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
  log,
});

const server = http.createServer(handler);
server.headersTimeout = 20000;
server.requestTimeout = 90000;
server.keepAliveTimeout = 65000;

const port = int(env.PORT, 8080);
server.listen(port, () => {
  const ai = aiSources.filter((s) => s.enabled()).map((s) => s.id);
  log(`medicine-finder ${version} listening on :${port}; data in ${dataDir}; AI providers: ${ai.length ? ai.join(", ") : "none (no keys set)"}`);
  // load missing or stale datasets in the background, then check again every hour
  datasets.refreshDue();
  setInterval(() => datasets.refreshDue(), 3600e3).unref();
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
