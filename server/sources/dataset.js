// A downloaded dataset that is kept in memory and refreshed on a schedule.

export class Dataset {
  /**
   * @param {object} opts
   * @param {() => Promise<any>} opts.load   downloads and parses the data, returns the index
   * @param {number} opts.refreshMs          how often to reload
   * @param {() => number} [opts.now]
   */
  constructor({ load, refreshMs, now = Date.now }) {
    this.load = load;
    this.refreshMs = refreshMs;
    this.now = now;
    this.index = null;
    this.loadedAt = null;
    this.error = null;
    this.pending = null;
  }

  /** Starts a load unless one is running or the data is still fresh. */
  refresh() {
    if (this.pending) return this.pending;
    if (this.loadedAt && this.now() - this.loadedAt < this.refreshMs) return Promise.resolve(this.index);
    this.pending = this.load()
      .then((index) => {
        this.index = index;
        this.loadedAt = this.now();
        this.error = null;
        return index;
      })
      .catch((err) => {
        // keep serving the previous copy if there is one
        this.error = err instanceof Error ? err.message : String(err);
        return this.index;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  /** Waits up to `waitMs` for the first load; afterwards returns whatever is in memory. */
  async ready(waitMs) {
    const p = this.refresh();
    if (this.index) return this.index;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, waitMs, null);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  status() {
    if (this.index) return { state: "ready", updatedAt: new Date(this.loadedAt).toISOString(), ...(this.error ? { detail: `last refresh failed: ${this.error}` } : {}) };
    if (this.error) return { state: "error", detail: this.error };
    return { state: "loading" };
  }
}
