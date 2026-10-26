// Which countries have official data right now, from the server's source list (so the numbers on
// the page follow the datasets that are actually loaded, never a hand-written count).

import { fetchServerSources, type ServerSourceInfo } from "./serverApi";

export interface Coverage {
  /** countries with at least one official source that is ready, sorted; the EU is not counted */
  countries: string[];
  /** EU-wide authorisations are available */
  eu: boolean;
}

const READY = new Set(["ready", "live"]);
const EU = "European Union";

export function coverageFrom(sources: ServerSourceInfo[]): Coverage {
  const names = new Set<string>();
  for (const s of sources) {
    if (s.kind !== "official" || !s.enabled || !READY.has(s.state)) continue;
    for (const c of s.countries ?? []) names.add(c);
  }
  const eu = names.delete(EU);
  return { countries: [...names].sort((a, b) => a.localeCompare(b)), eu };
}

let pending: Promise<Coverage | null> | null = null;

/** Loaded once per page; null where the server is not reachable (static hosting). */
export function loadCoverage(fetchImpl: typeof fetch = fetch): Promise<Coverage | null> {
  pending ??= fetchServerSources(fetchImpl)
    .then((r) => coverageFrom(r.sources))
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}
