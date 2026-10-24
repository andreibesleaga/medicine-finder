// Runs every enabled server-side source in parallel and reports what each one returned.

import { TtlCache } from "./lib/cache.js";

export const MAX_PER_SOURCE = 60;

export function createSearch({ sources, cacheTtlMs = 3600e3, aiDailyLimit = 500, now = Date.now, sourceTimeoutMs = 35000 }) {
  const cache = new TtlCache({ ttlMs: cacheTtlMs, maxEntries: 1000, now });
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
    const base = { id: source.id, name: source.name, kind: source.kind };
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
      const results = rows.slice(0, MAX_PER_SOURCE).map((r) => ({ ...r, sourceId: source.id, sourceName: source.name, kind: source.kind }));
      return { ...base, state: "ok", count, results, ms: now() - started };
    } catch (err) {
      return { ...base, state: "error", count: 0, results: [], detail: err instanceof Error ? err.message : String(err), ms: now() - started };
    } finally {
      clearTimeout(timer);
    }
  }

  return async function search(term, { country } = {}) {
    const key = `${term.toLowerCase()}|${country || ""}`;
    const cached = cache.get(key);
    if (cached) return { ...cached, cached: true };
    const runs = await Promise.all(sources.map((s) => runSource(s, term, { country })));
    const body = {
      term,
      country: country || null,
      results: runs.flatMap((r) => r.results),
      sources: runs.map((r) => ({ ...r, results: undefined })),
    };
    // a failed source is retried after a few minutes instead of the full hour
    cache.set(key, body, runs.some((r) => r.state === "error") ? Math.min(cacheTtlMs, 5 * 60e3) : cacheTtlMs);
    return body;
  };
}
