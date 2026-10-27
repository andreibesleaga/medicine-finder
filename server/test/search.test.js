import { describe, it, expect } from "vitest";
import { createSearch, MAX_PER_SOURCE } from "../search.js";
import { fixedClock } from "./helpers.js";
import { openStore } from "../db/store.js";
import { createWarmUp } from "../warmup.js";

const source = (id, kind, impl, enabled = true) => {
  const s = {
    id,
    name: `Source ${id}`,
    kind,
    calls: 0,
    enabled: () => enabled,
    status: () => (enabled ? { state: "live" } : { state: "disabled", detail: "no key" }),
    search: async (...args) => {
      s.calls += 1;
      return impl(...args);
    },
  };
  return s;
};

describe("server search", () => {
  it("tags results with their source and reports each source", async () => {
    const ok = source("a", "official", async () => [{ brandName: "Advil", activeIngredient: "ibuprofen", country: "Canada" }]);
    const bad = source("b", "official", async () => {
      throw new Error("HTTP 503");
    });
    const off = source("c", "ai", async () => [], false);
    const search = createSearch({ sources: [ok, bad, off], now: fixedClock() });
    const body = await search("ibuprofen");
    expect(body.results).toEqual([
      { brandName: "Advil", activeIngredient: "ibuprofen", country: "Canada", sourceId: "a", sourceName: "Source a", kind: "official" },
    ]);
    expect(body.sources.map((s) => [s.id, s.state, s.count])).toEqual([
      ["a", "ok", 1],
      ["b", "error", 0],
      ["c", "disabled", 0],
    ]);
    expect(body.sources[1].detail).toBe("HTTP 503");
    expect(body.sources[0].results).toBeUndefined();
  });

  it("reports a provider outage as unavailable and keeps it in the cache only briefly", async () => {
    const now = fixedClock();
    const down = source("hc", "official", async () => {
      throw Object.assign(new Error("Health Canada's API is not answering"), { unavailable: true });
    });
    const search = createSearch({ sources: [down], now });
    expect((await search("ibuprofen")).sources[0].state).toBe("unavailable");
    now.advance(6 * 60e3);
    await search("ibuprofen");
    expect(down.calls).toBe(2);
  });

  it("caps each source but reports the full count", async () => {
    const many = source("m", "official", async () => Array.from({ length: 75 }, (_, i) => ({ brandName: `B${i}`, activeIngredient: "x", country: "France" })));
    const body = await createSearch({ sources: [many], now: fixedClock() })("x");
    expect(body.results).toHaveLength(MAX_PER_SOURCE);
    expect(body.sources[0].count).toBe(75);
  });

  it("accepts { total, results } from database sources", async () => {
    const db = source("db", "official", async () => ({ total: 120, results: [{ brandName: "A", activeIngredient: "x", country: "Italy" }] }));
    const body = await createSearch({ sources: [db], now: fixedClock() })("x");
    expect(body.sources[0].count).toBe(120);
    expect(body.results).toHaveLength(1);
  });

  it("times out a slow source", async () => {
    const slow = source("s", "official", () => new Promise(() => {}));
    const body = await createSearch({ sources: [slow], sourceTimeoutMs: 20, now: fixedClock() })("x");
    expect(body.sources[0]).toMatchObject({ state: "error", detail: "no answer within 0.02 s" });
  });

  it("caches answers; failed searches only briefly", async () => {
    const now = fixedClock();
    let fail = true;
    const flaky = source("f", "official", async () => {
      if (fail) throw new Error("down");
      return [];
    });
    const search = createSearch({ sources: [flaky], now });
    await search("x");
    expect((await search("X")).cached).toBe(true);
    fail = false;
    now.advance(5 * 60e3 + 1);
    expect((await search("x")).cached).toBeUndefined();
    expect(flaky.calls).toBe(2);
    now.advance(30 * 60e3);
    expect((await search("x")).cached).toBe(true);
  });

  it("stops calling AI providers after the daily limit and resets the next day", async () => {
    const now = fixedClock(Date.parse("2026-01-15T23:00:00Z"));
    const ai = source("ai", "ai", async () => []);
    const search = createSearch({ sources: [ai], aiDailyLimit: 2, cacheTtlMs: 1, now });
    await search("a");
    await search("b");
    const third = await search("c");
    expect(third.sources[0]).toMatchObject({ state: "skipped", detail: "daily AI limit reached" });
    now.advance(2 * 3600e3);
    expect((await search("d")).sources[0].state).toBe("ok");
    expect(ai.calls).toBe(3);
  });

  it("does not keep a skipped AI answer past the daily reset", async () => {
    const now = fixedClock(Date.parse("2026-01-15T23:58:00Z"));
    const ai = source("ai", "ai", async () => []);
    const search = createSearch({ sources: [ai], aiDailyLimit: 1, cacheTtlMs: 24 * 3600e3, now });
    await search("a");
    expect((await search("b")).sources[0].state).toBe("skipped");
    now.advance(5 * 60e3 + 1);
    const next = await search("b");
    expect(next.cached).toBeUndefined();
    expect(next.sources[0].state).toBe("ok");
  });

  it("reports each source's homepage, terms and reuse condition with its run", async () => {
    const a = Object.assign(source("a", "official", async () => []), { homepage: "https://a", terms: "https://a/terms", reuse: "Not commercial" });
    const body = await createSearch({ sources: [a], now: fixedClock() })("ibuprofen");
    expect(body.sources[0]).toMatchObject({ id: "a", homepage: "https://a", terms: "https://a/terms", reuse: "Not commercial" });
  });

  it("asks every source for the ingredient a brand name stands for, and reports the brand", async () => {
    const seen = [];
    const a = source("a", "official", async (term) => {
      seen.push(term);
      return [{ brandName: "Advil", activeIngredient: "ibuprofen", country: "Canada" }];
    });
    const brand = { name: "Nurofen", ingredient: "Ibuprofen", searchFor: "ibuprofen", others: [] };
    const search = createSearch({ sources: [a], resolve: (t) => (t === "nurofen" ? brand : null), now: fixedClock() });
    const body = await search("nurofen");
    expect(seen).toEqual(["ibuprofen"]);
    expect(body).toMatchObject({ term: "nurofen", brand });
    expect((await search("ibuprofen")).brand).toBeUndefined();
  });

  it("runs one upstream round for identical searches at the same time", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const a = source("a", "official", async () => {
      await gate;
      return [{ brandName: "Advil", activeIngredient: "ibuprofen", country: "Canada" }];
    });
    const search = createSearch({ sources: [a], now: fixedClock() });
    const [x, y] = [search("Ibuprofen"), search(" ibuprofen ")];
    release();
    const [bx, by] = await Promise.all([x, y]);
    expect(a.calls).toBe(1);
    expect(bx).toBe(by);
  });

  it("keeps answers across a restart when given a store, until they expire", async () => {
    const now = fixedClock();
    const store = openStore(":memory:");
    const a = source("a", "official", async () => [{ brandName: "Advil", activeIngredient: "ibuprofen", country: "Canada" }]);
    const first = createSearch({ sources: [a], now, cacheTtlMs: 60e3, persist: store.answers("search", { now }) });
    await first("ibuprofen");
    // a new process: empty memory, same database
    const second = createSearch({ sources: [a], now, cacheTtlMs: 60e3, persist: store.answers("search", { now }) });
    expect(await second("ibuprofen")).toMatchObject({ cached: true, results: [{ brandName: "Advil" }] });
    expect(a.calls).toBe(1);
    now.advance(60e3);
    const third = createSearch({ sources: [a], now, cacheTtlMs: 60e3, persist: store.answers("search", { now }) });
    expect((await third("ibuprofen")).cached).toBeUndefined();
    expect(a.calls).toBe(2);
  });

  it("counts searched terms for the daily warm-up, most searched first", () => {
    const store = openStore(":memory:");
    for (const t of ["ibuprofen", "paracetamol", "ibuprofen"]) store.countQuery(t, 1000);
    store.countQuery("old", 10);
    expect(store.topQueries(10, 500)).toEqual(["ibuprofen", "paracetamol"]);
  });

  it("keeps the answer table within its cap, pruning at most every few minutes", () => {
    const now = fixedClock();
    const store = openStore(":memory:");
    const answers = store.answers("t", { now, maxRows: 3, pruneEveryMs: 60e3 });
    for (let i = 0; i < 6; i++) answers.set(`k${i}`, { i }, now() + 3600e3 + i);
    // the first set pruned (nothing to do); the next five waited for the interval
    expect(answers.get("k0")).toBeDefined();
    now.advance(60e3);
    answers.set("k6", { i: 6 }, now() + 3600e3 + 6);
    // over the cap: the ones expiring first went
    expect(["k0", "k1", "k2", "k3"].map((k) => answers.get(k))).toEqual([undefined, undefined, undefined, undefined]);
    expect(answers.get("k6")).toEqual({ body: { i: 6 }, expiresAt: now() + 3600e3 + 6 });
  });

  it("still answers when the answer store fails, and gives each caller its own spelling of the term", async () => {
    const a = source("a", "official", async () => [{ brandName: "Advil", activeIngredient: "ibuprofen", country: "Canada" }]);
    const broken = { get: () => { throw new Error("SQLITE_BUSY"); }, set: () => { throw new Error("disk full"); } };
    const search = createSearch({ sources: [a], now: fixedClock(), persist: broken });
    expect((await search("Ibuprofen")).results).toHaveLength(1);
    expect(await search("IBUPROFEN")).toMatchObject({ term: "IBUPROFEN", cached: true });
    expect(a.calls).toBe(1);
  });

  it("warms the most searched terms once a day, and survives a failing store", async () => {
    const now = fixedClock();
    const store = openStore(":memory:");
    for (const t of ["ibuprofen", "ibuprofen", "paracetamol"]) store.countQuery(t, now());
    const seen = [];
    const warm = createWarmUp({ search: async (t) => seen.push(t), store, terms: 5, now, pause: async () => {} });
    now.advance(1); // last warm-up "never": the first call runs
    expect(await warm()).toBe(2);
    expect(seen).toEqual(["ibuprofen", "paracetamol"]);
    expect(await warm()).toBe(0); // not again the same day
    now.advance(24 * 3600e3);
    const failing = createWarmUp({ search: async () => {}, store: { topQueries: () => { throw new Error("db"); } }, now, pause: async () => {} });
    await expect(failing()).resolves.toBe(0);
  });
});
