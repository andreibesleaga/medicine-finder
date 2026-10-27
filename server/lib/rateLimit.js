// Sliding-window rate limiter keyed by client address (one replica, so in memory is enough).
// The count of the previous window is weighted by how much of it still overlaps the last
// `windowMs`, so a client cannot send twice the limit around a window boundary.

export class RateLimiter {
  constructor({ limit, windowMs, now = Date.now, maxKeys = 10000 }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.maxKeys = maxKeys;
    // key -> { start, count, previous }, least recently seen first
    this.hits = new Map();
  }

  /** Returns { ok, remaining, retryAfterSec }. */
  take(key) {
    const t = this.now();
    const windowStart = t - (t % this.windowMs);
    let entry = this.hits.get(key);
    if (entry) this.hits.delete(key);
    if (!entry || entry.start < windowStart - this.windowMs) entry = { start: windowStart, count: 0, previous: 0 };
    else if (entry.start < windowStart) entry = { start: windowStart, count: 0, previous: entry.count };
    // the least recently seen clients make room for new ones
    while (this.hits.size >= this.maxKeys) this.hits.delete(this.hits.keys().next().value);
    this.hits.set(key, entry);

    const overlap = 1 - (t - windowStart) / this.windowMs;
    const used = entry.previous * overlap + entry.count;
    const ok = used + 1 <= this.limit;
    if (ok) entry.count += 1;
    const remaining = Math.max(0, Math.floor(this.limit - used - (ok ? 1 : 0)));
    const retryAfterSec = ok ? 0 : Math.max(1, Math.ceil(this.waitMs(entry, t - windowStart) / 1000));
    return { ok, remaining, retryAfterSec };
  }

  /** Time until one more call fits: the weighted count of the previous window must fall far enough. */
  waitMs(entry, elapsed) {
    const W = this.windowMs;
    const room = this.limit - entry.count - 1;
    // still in this window: previous * (1 - x / W) <= room, with x the elapsed time then
    if (room >= 0 && entry.previous > 0) return Math.max(0, W * (1 - room / entry.previous) - elapsed);
    // only in the next window, where this window's calls become the previous ones
    const nextRoom = this.limit - 1;
    const intoNext = entry.count > 0 ? Math.max(0, W * (1 - nextRoom / entry.count)) : 0;
    return W - elapsed + intoNext;
  }
}

/**
 * Client address behind Railway's proxy. Railway documents X-Real-IP as the client's address
 * (https://docs.railway.com/networking/public-networking/specs-and-limits); X-Forwarded-For is
 * only a fallback, because a client can send its own, and can be switched off for a server that
 * no proxy fronts (TRUST_FORWARDED_FOR=false). A global limit (app.js) caps what forged addresses
 * could still do.
 */
export function clientKey(req, { trustForwardedFor = true } = {}) {
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  if (!trustForwardedFor) return req.socket?.remoteAddress || "unknown";
  const xff = req.headers["x-forwarded-for"];
  const first = typeof xff === "string" ? xff.split(",")[0].trim() : "";
  return first || req.socket?.remoteAddress || "unknown";
}
