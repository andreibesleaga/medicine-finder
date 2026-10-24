// Runs the sources in parallel, reports progress, then merges and orders the results.
// Official national data comes first; AI suggestions are fetched afterwards (addAiSuggestions)
// because language models can take much longer.

import type { MedicineResult, SearchOutcome, SourceKind, SourceRun } from "@/types/medicine";
import { BROWSER_SOURCES, clinicalTrials } from "./browserSources";
import { searchAi, searchServer } from "./serverApi";
import { scopeResults, selectionForServer } from "./countryScope";

const KIND_ORDER: Record<SourceKind, number> = { official: 0, reference: 1, curated: 2, ai: 3 };

/** Within open references, the curated registries come before the crowd-sourced ones. */
const SOURCE_RANK: Record<string, number> = { rxnorm: 0, openfda: 1, wikidata: 2, pubchem: 3 };

const rank = (r: Omit<MedicineResult, "id">) => KIND_ORDER[r.kind] * 10 + (SOURCE_RANK[r.sourceId] ?? 0);

const SERVER_PLACEHOLDER: SourceRun = {
  id: "server",
  name: "Official national databases (search server)",
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
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b));
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
    byKey.set(key, { ...r, alsoIn: r.alsoIn ? [...r.alsoIn] : undefined, id: `${r.sourceId}-${byKey.size}` });
  }
  const all = [...byKey.values()];
  const withCountry = new Map<string, MedicineResult>();
  for (const r of all) if (r.country !== "Not stated" && !withCountry.has(brandKey(r.brandName))) withCountry.set(brandKey(r.brandName), r);
  const kept = all.filter((r) => {
    const match = r.country === "Not stated" ? withCountry.get(brandKey(r.brandName)) : undefined;
    if (!match) return true;
    if (!match.alsoIn?.includes(r.sourceName)) match.alsoIn = [...(match.alsoIn ?? []), r.sourceName];
    return false;
  });
  // most reliable source first; single-ingredient before combinations; then brands more sources
  // agree on; then by name
  const combo = (r: MedicineResult) => (/\s\+\s/.test(r.activeIngredient) ? 1 : 0);
  return kept.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      combo(a) - combo(b) ||
      (b.alsoIn?.length ?? 0) - (a.alsoIn?.length ?? 0) ||
      a.brandName.localeCompare(b.brandName),
  );
}

const sortRuns = (runs: SourceRun[]) => [...runs].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

/** All merged rows of an outcome before country scoping, kept so AI rows can be merged in later. */
const rawRows = new WeakMap<SearchOutcome, Omit<MedicineResult, "id">[]>();

function finish(term: string, selection: string | undefined, rows: Omit<MedicineResult, "id">[], sources: SourceRun[], extra: Partial<SearchOutcome>) {
  const scoped = scopeResults(mergeResults(rows), selection);
  const outcome: SearchOutcome = { term, country: selection, results: scoped.results, note: scoped.note, sources: sortRuns(sources), ...extra };
  rawRows.set(outcome, rows);
  return outcome;
}

/** Official databases, open references and curated samples; `aiPending` is set for the AI phase. */
export async function searchMedicines(
  term: string,
  selection: string | undefined,
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
      const body = await searchServer(term, selectionForServer(selection), fetchImpl);
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
  const serverReached = runs.get(SERVER_PLACEHOLDER.id)?.state !== "unavailable";
  return finish(term, selection, rows, [...runs.values()], { trials: trials ?? undefined, aiPending: serverReached });
}

/** Adds the AI suggestions to an outcome (or marks them unavailable). */
export async function addAiSuggestions(outcome: SearchOutcome, fetchImpl: typeof fetch = fetch): Promise<SearchOutcome> {
  const rows = [...(rawRows.get(outcome) ?? outcome.results)];
  let sources = outcome.sources;
  try {
    const body = await searchAi(outcome.term, selectionForServer(outcome.country), fetchImpl);
    rows.push(...body.results);
    sources = [...sources, ...body.sources];
  } catch (err) {
    sources = [...sources, { id: "ai", name: "AI suggestions", kind: "ai", state: "unavailable", count: 0, detail: message(err) }];
  }
  return finish(outcome.term, outcome.country, rows, sources, { trials: outcome.trials, aiPending: false });
}
