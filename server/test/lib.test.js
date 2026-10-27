import { describe, it, expect } from "vitest";
import { RateLimiter, clientKey } from "../lib/rateLimit.js";
import { TtlCache } from "../lib/cache.js";
import { fixedClock } from "./helpers.js";

describe("RateLimiter", () => {
  it("allows up to the limit, then refuses with a retry delay", () => {
    const now = fixedClock();
    const rl = new RateLimiter({ limit: 2, windowMs: 60_000, now });
    expect(rl.take("a")).toEqual({ ok: true, remaining: 1, retryAfterSec: 0 });
    expect(rl.take("a")).toEqual({ ok: true, remaining: 0, retryAfterSec: 0 });
    now.advance(10_500);
    // the rest of this window, then until the two calls of this window count for less than one
    expect(rl.take("a")).toEqual({ ok: false, remaining: 0, retryAfterSec: 80 });
    expect(rl.take("b").ok).toBe(true); // other keys are independent
  });

  it("counts the previous window by how much of it still overlaps, so a boundary does not double the limit", () => {
    const now = fixedClock();
    const rl = new RateLimiter({ limit: 1, windowMs: 1000, now });
    rl.take("a");
    expect(rl.take("a").ok).toBe(false);
    now.advance(1000); // new window, but the previous one still fully overlaps
    expect(rl.take("a")).toEqual({ ok: false, remaining: 0, retryAfterSec: 1 });
    now.advance(600); // 40 % of the previous window still counts: 0.4 + 1 > 1
    expect(rl.take("a").ok).toBe(false);
    now.advance(400); // the next window: the refused calls were not counted, so nothing is left over
    expect(rl.take("a")).toEqual({ ok: true, remaining: 0, retryAfterSec: 0 });
  });

  it("gives a Retry-After that is enough: a client that waits exactly that long gets through", () => {
    for (const [limit, used, at] of [[2, 2, 10_500], [20, 20, 0], [20, 20, 59_000], [5, 3, 30_000]]) {
      const now = fixedClock();
      const rl = new RateLimiter({ limit, windowMs: 60_000, now });
      for (let i = 0; i < used; i++) rl.take("a");
      now.advance(at);
      let refused = rl.take("a");
      while (refused.ok) refused = rl.take("a");
      now.advance(refused.retryAfterSec * 1000);
      expect(rl.take("a").ok, `limit ${limit}`).toBe(true);
    }
  });

  it("makes room by forgetting the least recently seen client", () => {
    const now = fixedClock();
    const rl = new RateLimiter({ limit: 5, windowMs: 1000, maxKeys: 2, now });
    rl.take("a");
    rl.take("b");
    rl.take("a"); // a seen again: b is now the least recent
    rl.take("c");
    expect([...rl.hits.keys()]).toEqual(["a", "c"]);
  });
});

describe("clientKey", () => {
  it("prefers X-Real-IP, which Railway sets, over X-Forwarded-For, which a client can send", () => {
    expect(clientKey({ headers: { "x-real-ip": "198.51.100.4", "x-forwarded-for": "1.2.3.4, 198.51.100.4" } })).toBe("198.51.100.4");
  });

  it("ignores X-Forwarded-For when told no proxy fronts the server", () => {
    const req = { headers: { "x-forwarded-for": "1.2.3.4" }, socket: { remoteAddress: "10.0.0.2" } };
    expect(clientKey(req, { trustForwardedFor: false })).toBe("10.0.0.2");
    expect(clientKey({ ...req, headers: { ...req.headers, "x-real-ip": "198.51.100.4" } }, { trustForwardedFor: false })).toBe("198.51.100.4");
  });

  it("uses the first X-Forwarded-For entry when there is no X-Real-IP", () => {
    expect(clientKey({ headers: { "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }, socket: { remoteAddress: "10.0.0.2" } })).toBe("203.0.113.7");
  });

  it("falls back to the socket address when the header is missing or empty", () => {
    expect(clientKey({ headers: {}, socket: { remoteAddress: "10.0.0.2" } })).toBe("10.0.0.2");
    expect(clientKey({ headers: { "x-forwarded-for": "" }, socket: { remoteAddress: "10.0.0.2" } })).toBe("10.0.0.2");
  });

  it("returns 'unknown' when there is nothing to go on", () => {
    expect(clientKey({ headers: {} })).toBe("unknown");
    expect(clientKey({ headers: {}, socket: {} })).toBe("unknown");
  });
});

describe("TtlCache", () => {
  it("returns a value until its ttl has passed", () => {
    const now = fixedClock();
    const cache = new TtlCache({ ttlMs: 1000, now });
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    now.advance(999);
    expect(cache.get("k")).toBe("v");
    now.advance(1);
    expect(cache.get("k")).toBeUndefined();
    expect(cache.map.size).toBe(0); // the expired entry is dropped
    expect(cache.get("missing")).toBeUndefined();
  });

  it("honours a per-entry ttl", () => {
    const now = fixedClock();
    const cache = new TtlCache({ ttlMs: 1000, now });
    cache.set("short", 1, 100);
    cache.set("default", 2);
    now.advance(100);
    expect(cache.get("short")).toBeUndefined();
    expect(cache.get("default")).toBe(2);
  });

  it("evicts the oldest entry beyond maxEntries; re-setting refreshes the position", () => {
    const cache = new TtlCache({ ttlMs: 1000, maxEntries: 2, now: fixedClock() });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 3); // a is now the newest
    cache.set("c", 4); // evicts b
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(3);
    expect(cache.get("c")).toBe(4);
  });

  it("keeps recently read entries and drops the least recently used", () => {
    const cache = new TtlCache({ ttlMs: 1000, maxEntries: 2, now: fixedClock() });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // a used: b is now the least recent
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
  });

  it("stays within its byte bound and skips a value larger than the whole bound", () => {
    const cache = new TtlCache({ ttlMs: 1000, maxBytes: 10, sizeOf: (v) => v.length, now: fixedClock() });
    cache.set("a", "12345");
    cache.set("b", "123456"); // 11 bytes in all: a goes
    expect(cache.get("a")).toBeUndefined();
    expect(cache.bytes).toBe(6);
    cache.set("huge", "x".repeat(11));
    expect(cache.get("huge")).toBeUndefined();
    expect(cache.get("b")).toBe("123456");
  });
});
