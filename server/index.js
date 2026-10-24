// Entry point: node server/index.js (serves dist/ and /api on $PORT).

import http from "node:http";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createSearch } from "./search.js";
import { createEmaSource } from "./sources/ema.js";
import { createBdpmSource } from "./sources/bdpm.js";
import { createCimaSource } from "./sources/cima.js";
import { createHealthCanadaSource } from "./sources/healthCanada.js";
import { createAiSources } from "./sources/ai.js";

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

const deps = { fetch: globalThis.fetch, env };
const ema = createEmaSource(deps);
const bdpm = createBdpmSource(deps);
const sources = [ema, bdpm, createCimaSource(deps), createHealthCanadaSource(deps), ...createAiSources(deps)];

const search = createSearch({
  sources,
  cacheTtlMs: int(env.SEARCH_CACHE_SECONDS, 3600) * 1000,
  aiDailyLimit: int(env.AI_DAILY_LIMIT, 500),
});

const handler = createApp({
  distDir: path.resolve(root, env.DIST_DIR || "dist"),
  search,
  sources,
  version,
  allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  rateLimit: { limit: int(env.SEARCH_RATE_LIMIT, 20), windowMs: 60e3 },
  log,
});

const server = http.createServer(handler);
server.headersTimeout = 20000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 65000;

const port = int(env.PORT, 8080);
server.listen(port, () => {
  const ai = sources.filter((s) => s.kind === "ai" && s.enabled()).map((s) => s.id);
  log(`medicine-finder ${version} listening on :${port}; AI providers: ${ai.length ? ai.join(", ") : "none (no keys set)"}`);
  // load the downloaded datasets in the background, then refresh them once a day
  for (const d of [ema.dataset, bdpm.dataset]) d.refresh();
  setInterval(() => {
    for (const d of [ema.dataset, bdpm.dataset]) d.refresh();
  }, 3600e3).unref();
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    log(`${sig} received, closing`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
