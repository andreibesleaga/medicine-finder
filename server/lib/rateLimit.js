// Fixed-window rate limiter keyed by client address.

export class RateLimiter {
  constructor({ limit, windowMs, now = Date.now, maxKeys = 10000 }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.maxKeys = maxKeys;
    this.hits = new Map();
  }

  /** Returns { ok, remaining, retryAfterSec }. */
  take(key) {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.reset <= t) {
      if (this.hits.size >= this.maxKeys) this.prune(t);
      entry = { count: 0, reset: t + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    const ok = entry.count <= this.limit;
    return {
      ok,
      remaining: Math.max(0, this.limit - entry.count),
      retryAfterSec: ok ? 0 : Math.ceil((entry.reset - t) / 1000),
    };
  }

  prune(t) {
    for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k);
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}

/** Client address behind Railway's proxy: the first X-Forwarded-For entry, else the socket address. */
export function clientKey(req) {
  const xff = req.headers["x-forwarded-for"];
  const first = typeof xff === "string" ? xff.split(",")[0].trim() : "";
  return first || req.socket?.remoteAddress || "unknown";
}
