// Small in-memory cache with a time-to-live, bounded by entries and by an estimate of its size in
// bytes; the least recently used entry is evicted first.

export class TtlCache {
  constructor({ ttlMs, maxEntries = 500, maxBytes = Infinity, sizeOf = (v) => JSON.stringify(v)?.length ?? 0, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.sizeOf = sizeOf;
    this.now = now;
    this.map = new Map();
    this.bytes = 0;
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.delete(key);
      return undefined;
    }
    // used now: move to the end, so the least recently used is first
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    this.delete(key);
    const size = this.maxBytes === Infinity ? 0 : this.sizeOf(value);
    if (size > this.maxBytes) return;
    this.map.set(key, { value, expires: this.now() + ttlMs, size });
    this.bytes += size;
    while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) this.delete(this.map.keys().next().value);
  }

  delete(key) {
    const hit = this.map.get(key);
    if (!hit) return;
    this.bytes -= hit.size;
    this.map.delete(key);
  }
}
