import { describe, it, expect } from "vitest";
import { createSearch, MAX_PER_SOURCE } from "../search.js";
import { fixedClock } from "./helpers.js";

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

  it("caps each source but reports the full count", async () => {
    const many = source("m", "official", async () => Array.from({ length: 75 }, (_, i) => ({ brandName: `B${i}`, activeIngredient: "x", country: "France" })));
    const body = await createSearch({ sources: [many], now: fixedClock() })("x");
    expect(body.results).toHaveLength(MAX_PER_SOURCE);
    expect(body.sources[0].count).toBe(75);
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
});
