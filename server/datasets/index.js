// Loads the national datasets into SQLite in the background (one at a time) and exposes each
// one as a search source.

import { stems } from "../lib/text.js";
import { MAX_PER_SOURCE } from "../search.js";
import { withSynonyms } from "../lib/synonyms.js";
import { ema } from "./ema.js";
import { bdpm } from "./bdpm.js";
import { aifa } from "./aifa.js";
import { urpl } from "./urpl.js";
import { cbg } from "./cbg.js";
import { hpra } from "./hpra.js";
import { swissmedic } from "./swissmedic.js";
import { sukl } from "./sukl.js";
import { dkma } from "./dkma.js";
import { dpd } from "./dpd.js";
import { mpa } from "./mpa.js";
import { vvkt } from "./vvkt.js";
import { drlz } from "./drlz.js";
import { maltama } from "./maltama.js";
import { usfda } from "./usfda.js";
import { invima } from "./invima.js";
import { tfda } from "./tfda.js";
import { hsa } from "./hsa.js";
import { pharmac } from "./pharmac.js";
import { fimea } from "./fimea.js";
import { curated } from "./curated.js";

// loaded in this order after a start: Europe, then the Americas, then Asia-Pacific
export const DATASETS = [
  ema, bdpm, aifa, urpl, cbg, hpra, swissmedic, sukl, dkma, mpa, vvkt, drlz, maltama, fimea,
  dpd, usfda, invima,
  tfda, hsa, pharmac,
  curated,
];

const RETRY_AFTER_MS = 3600e3;
// Raise by one when a loader's output or the word index changes: every dataset saved with an older
// format is then reloaded once after the deploy (its old rows are served until then).
export const DATA_FORMAT = 2;

// A dataset may also define available(ctx) (false: shown as off, not loaded; e.g. a file imported by
// hand that is not there yet) and modifiedAt(ctx) (reload when its source is newer than the data).
export function createDatasetSources({ store, datasets = DATASETS, fetch, now = Date.now, log = () => {}, limit = MAX_PER_SOURCE, importDir }) {
  const ctx = { importDir };
  const available = (d) => !d.available || d.available(ctx);
  const loading = new Set();
  // datasets with refreshMs 0 (built-in data) are reloaded once per start, so edits apply on deploy
  const loadedThisRun = new Set();

  function status(d) {
    if (!available(d)) return { state: "disabled", detail: d.unavailableDetail };
    const info = store.info(d.id);
    const base = info?.loaded_at
      ? { state: "ready", rows: info.rows, updatedAt: new Date(info.loaded_at).toISOString() }
      : { state: loading.has(d.id) ? "loading" : info?.error ? "error" : "loading" };
    if (loading.has(d.id) && info?.loaded_at) base.detail = "refreshing";
    if (info?.error) base.detail = info.loaded_at ? `last refresh failed: ${info.error}` : info.error;
    return base;
  }

  const sources = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    coverage: d.coverage,
    homepage: d.homepage,
    terms: d.terms,
    enabled: () => available(d),
    status: () => status(d),
    async search(term) {
      if (!store.info(d.id)?.loaded_at) {
        throw new Error(loading.has(d.id) ? "data is still loading" : "data not loaded yet");
      }
      // search each name of the ingredient (e.g. paracetamol and acetaminophen), brands merged
      const seen = new Map();
      let total = 0;
      for (const name of withSynonyms(term)) {
        const { total: t, results } = store.search(d.id, stems(name), limit);
        total += t;
        for (const r of results) if (!seen.has(r.brandName.toLowerCase())) seen.set(r.brandName.toLowerCase(), r);
      }
      return { total: Math.max(total, seen.size), results: [...seen.values()].slice(0, limit) };
    },
  }));

  /** Loads every dataset that is missing or older than its refresh interval, one after another. */
  async function refreshDue() {
    for (const d of datasets) {
      const info = store.info(d.id);
      if (!available(d)) continue;
      const modified = d.modifiedAt?.(ctx);
      const newerSource = Boolean(info?.loaded_at) && modified > info.loaded_at;
      const current = Boolean(info?.loaded_at) && info.format === DATA_FORMAT;
      const fresh = d.refreshMs === 0 ? loadedThisRun.has(d.id) : current && now() - info.loaded_at < d.refreshMs && !newerSource;
      if (fresh || loading.has(d.id)) continue;
      // after a failed download, wait an hour before trying again (at once if a newer file was imported)
      const retryLater = info?.error && info.attempted_at && now() - info.attempted_at < RETRY_AFTER_MS;
      if (retryLater && !(modified > info.attempted_at)) continue;
      loading.add(d.id);
      const started = now();
      try {
        const rows = await d.load(fetch, ctx);
        if (!rows.length) throw new Error("the download contained no usable rows");
        store.replace(d.id, rows, now(), DATA_FORMAT);
        loadedThisRun.add(d.id);
        log(`dataset ${d.id}: ${rows.length} rows in ${Math.round((now() - started) / 1000)} s`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        store.markError(d.id, msg.slice(0, 200), now());
        log(`dataset ${d.id} failed: ${msg}`);
      } finally {
        loading.delete(d.id);
      }
    }
  }

  return { sources, refreshDue };
}
