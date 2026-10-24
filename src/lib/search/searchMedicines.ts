// Runs every source in parallel, reports progress, then merges and orders the results.

import type { MedicineResult, SearchOutcome, SourceKind, SourceRun } from "@/types/medicine";
import { BROWSER_SOURCES, clinicalTrials } from "./browserSources";
import { CURATED_SOURCE, searchCurated } from "./curated";
import { searchServer } from "./serverApi";

const KIND_ORDER: Record<SourceKind, number> = { official: 0, reference: 1, curated: 2, ai: 3 };

const SERVER_PLACEHOLDER: SourceRun = {
  id: "server",
  name: "Official databases and AI (search server)",
  kind: "official",
  state: "pending",
  count: 0,
};

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const brandKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * One card per brand and country, taken from the most reliable source (official, then reference,
 * curated, AI); the other sources that list it are kept in `alsoIn`. Rows without a country are
 * dropped when the same brand is already listed for a country.
 */
export function mergeResults(rows: Omit<MedicineResult, "id">[]): MedicineResult[] {
  const sorted = [...rows].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const byKey = new Map<string, MedicineResult>();
  for (const r of sorted) {
    const key = `${brandKey(r.brandName)}|${r.country.toLowerCase()}`;
    const first = byKey.get(key);
    if (first) {
      if (first.sourceName !== r.sourceName && !first.alsoIn?.includes(r.sourceName)) {
        first.alsoIn = [...(first.alsoIn ?? []), r.sourceName];
      }
      continue;
    }
    byKey.set(key, { ...r, id: `${r.sourceId}-${byKey.size}` });
  }
  const all = [...byKey.values()];
  const withCountry = new Map<string, MedicineResult>();
  for (const r of all) if (r.country !== "Not stated" && !withCountry.has(brandKey(r.brandName))) withCountry.set(brandKey(r.brandName), r);
  return all.filter((r) => {
    const kept = r.country === "Not stated" ? withCountry.get(brandKey(r.brandName)) : undefined;
    if (!kept) return true;
    if (!kept.alsoIn?.includes(r.sourceName)) kept.alsoIn = [...(kept.alsoIn ?? []), r.sourceName];
    return false;
  });
}

/** Keeps results for the chosen country plus those that apply to it (EU-wide, not stated). */
export function filterByCountry(results: MedicineResult[], country?: string): MedicineResult[] {
  if (!country) return results;
  const c = country.toLowerCase();
  const eu = EU_MEMBERS.has(c);
  return results.filter((r) => {
    const rc = r.country.toLowerCase();
    return rc === c || rc === "not stated" || (eu && rc === "european union");
  });
}

const EU_MEMBERS = new Set(
  [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France",
    "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
    "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
  ].map((s) => s.toLowerCase()),
);

export async function searchMedicines(
  term: string,
  country: string | undefined,
  onProgress: (sources: SourceRun[]) => void = () => {},
  fetchImpl: typeof fetch = fetch,
): Promise<SearchOutcome> {
  const runs = new Map<string, SourceRun>();
  const rows: Omit<MedicineResult, "id">[] = [];
  const emit = () => onProgress([...runs.values()]);
  const set = (run: SourceRun) => {
    runs.set(run.id, run);
    emit();
  };

  for (const s of BROWSER_SOURCES) set({ id: s.id, name: s.name, kind: s.kind, state: "pending", count: 0 });
  set(SERVER_PLACEHOLDER);

  const curated = searchCurated(term);
  rows.push(...curated);
  set({ ...CURATED_SOURCE, state: "ok", count: curated.length });

  const browserJobs = BROWSER_SOURCES.map(async (s) => {
    try {
      const found = await s.search(term, fetchImpl);
      rows.push(...found.map((r) => ({ ...r, sourceId: s.id, sourceName: s.name, kind: s.kind })));
      set({ id: s.id, name: s.name, kind: s.kind, state: "ok", count: found.length });
    } catch (err) {
      set({ id: s.id, name: s.name, kind: s.kind, state: "error", count: 0, detail: message(err) });
    }
  });

  const serverJob = (async () => {
    try {
      const body = await searchServer(term, country, fetchImpl);
      runs.delete(SERVER_PLACEHOLDER.id);
      rows.push(...body.results);
      for (const run of body.sources) runs.set(run.id, run);
      emit();
    } catch (err) {
      set({ ...SERVER_PLACEHOLDER, state: "unavailable", detail: message(err) });
    }
  })();

  const trialsJob = clinicalTrials(term, fetchImpl).catch(() => undefined);

  const [, , trials] = await Promise.all([Promise.all(browserJobs), serverJob, trialsJob]);
  return {
    term,
    country,
    results: filterByCountry(mergeResults(rows), country),
    sources: [...runs.values()].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]),
    trials: trials ?? undefined,
  };
}
