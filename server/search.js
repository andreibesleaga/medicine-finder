// Runs every enabled server-side source in parallel and reports what each one returned.

import { TtlCache } from "./lib/cache.js";

export const MAX_PER_SOURCE = 60;
const RETRY_SOON = new Set(["error", "unavailable", "skipped"]);
const RETRY_SOON_MS = 5 * 60e3;

/**
 * `resolve(term)` may turn a brand name into the ingredient to search for ({ searchFor, ... }); the
 * answer then carries it as `brand` and every source is asked for the ingredient.
 */
/**
 * `persist` ({ get(key), set(key, body, expiresAt) }, optional) keeps answers across restarts; the
 * in-memory cache is bounded to `maxCacheBytes` of answers.
 */
export function createSearch({
  sources,
  resolve = () => null,
  cacheTtlMs = 3600e3,
  aiDailyLimit = 500,
  now = Date.now,
  sourceTimeoutMs = 35000,
  persist = null,
  maxCacheBytes = 64 * 1024 * 1024,
}) {
  const cache = new TtlCache({ ttlMs: cacheTtlMs, maxEntries: 1000, maxBytes: maxCacheBytes, now });
  // one upstream round per term at a time: a second identical search waits for the first
  const inFlight = new Map();
  let aiDay = "";
  let aiCalls = 0;

  const aiBudgetLeft = () => {
    const day = new Date(now()).toISOString().slice(0, 10);
    if (day !== aiDay) {
      aiDay = day;
      aiCalls = 0;
    }
    return aiCalls < aiDailyLimit;
  };

  async function runSource(source, term, ctx) {
    const started = now();
    // the source's terms travel with every answer, so a download can name them without another call
    const base = {
      id: source.id,
      name: source.name,
      kind: source.kind,
      ...(source.homepage ? { homepage: source.homepage } : {}),
      ...(source.terms ? { terms: source.terms } : {}),
      ...(source.reuse ? { reuse: source.reuse } : {}),
    };
    if (!source.enabled()) return { ...base, state: "disabled", count: 0, results: [], detail: source.status().detail };
    if (source.kind === "ai") {
      if (!aiBudgetLeft()) return { ...base, state: "skipped", count: 0, results: [], detail: "daily AI limit reached" };
      aiCalls += 1;
    }
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${sourceTimeoutMs / 1000} s`)), sourceTimeoutMs);
      });
      // a source returns either an array or { total, results } (the database counts brands)
      const out = await Promise.race([source.search(term, ctx), timeout]);
      const rows = Array.isArray(out) ? out : out.results;
      const count = Array.isArray(out) ? out.length : out.total;
      // a source covering several countries may return more (a few per country)
      const results = rows.slice(0, source.maxResults ?? MAX_PER_SOURCE).map((r) => ({ ...r, sourceId: source.id, sourceName: source.name, kind: source.kind }));
      return { ...base, state: "ok", count, results, ms: now() - started };
    } catch (err) {
      // a source sets err.unavailable when the provider itself is down (shown as "not available")
      const state = err?.unavailable ? "unavailable" : "error";
      return { ...base, state, count: 0, results: [], detail: err instanceof Error ? err.message : String(err), ms: now() - started };
    } finally {
      clearTimeout(timer);
    }
  }

  // the cache and its database are helpers: when they fail, the search still answers
  const safely = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  return async function search(term, { country } = {}) {
    const key = `${term.toLowerCase().replace(/\s+/g, " ").trim()}|${(country || "").toLowerCase()}`;
    // each caller sees the term as it typed it, whoever asked first
    const cached = cache.get(key);
    if (cached) return { ...cached, term, cached: true };
    const stored = safely(() => persist?.get(key));
    if (stored) {
      cache.set(key, stored.body, stored.expiresAt - now());
      return { ...stored.body, term, cached: true };
    }
    const running = inFlight.get(key);
    if (running) return running;
    const job = answer(term, country, key).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
    return job;
  };

  async function answer(term, country, key) {
    const brand = resolve(term);
    const query = brand?.searchFor ?? term;
    const runs = await Promise.all(sources.map((s) => runSource(s, query, { country })));
    const body = {
      term,
      ...(brand ? { brand } : {}),
      country: country || null,
      results: runs.flatMap((r) => r.results),
      sources: runs.map((r) => ({ ...r, results: undefined })),
    };
    // a failed source (or an AI call skipped by the daily limit) is retried after a few minutes
    const retrySoon = runs.some((r) => RETRY_SOON.has(r.state));
    const ttl = retrySoon ? Math.min(cacheTtlMs, RETRY_SOON_MS) : cacheTtlMs;
    cache.set(key, body, ttl);
    safely(() => persist?.set(key, body, now() + ttl));
    return body;
  }
}
