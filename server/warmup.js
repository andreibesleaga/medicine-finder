// Once a day, the most searched terms of the last 30 days are searched again, so their answers are
// ready when a visitor asks (official sources only; AI calls cost money and are not warmed).

const DAY = 24 * 3600e3;

export function createWarmUp({ search, store, terms = 50, now = Date.now, pause = (ms) => new Promise((r) => setTimeout(r, ms).unref?.()), log = () => {} }) {
  let last = 0;
  let running = false;
  return async function warmUp() {
    if (!terms || running || now() - last < DAY) return 0;
    last = now();
    running = true;
    let done = 0;
    try {
      for (const term of store.topQueries(terms, now() - 30 * DAY)) {
        await search(term).catch(() => {});
        done += 1;
        await pause(2000);
      }
    } catch (err) {
      log(`warm-up stopped: ${err instanceof Error ? err.message : err}`);
    } finally {
      running = false;
    }
    return done;
  };
}
