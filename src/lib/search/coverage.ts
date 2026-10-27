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

let pending: Promise<ServerSourceInfo[] | null> | null = null;

/** The server's source list, loaded once per page; null where the server is not reachable (static hosting). */
export function loadServerSources(fetchImpl: typeof fetch = fetch): Promise<ServerSourceInfo[] | null> {
  pending ??= fetchServerSources(fetchImpl)
    .then((r) => r.sources)
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

/** Forgets the loaded list (tests; a page keeps it for its lifetime). */
export function forgetServerSources() {
  pending = null;
}

export async function loadCoverage(fetchImpl: typeof fetch = fetch): Promise<Coverage | null> {
  const sources = await loadServerSources(fetchImpl);
  return sources ? coverageFrom(sources) : null;
}

/**
 * Ids of the server sources that are on, waiting at most `waitMs` for the list (the page asks for
 * it on load); empty when it is not there in time.
 */
export async function serverSourcesOn(fetchImpl: typeof fetch = fetch, waitMs = 1500): Promise<Set<string>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), waitMs)));
  try {
    const sources = await Promise.race([loadServerSources(fetchImpl), timeout]);
    return new Set((sources ?? []).filter((s) => s.enabled).map((s) => s.id));
  } finally {
    clearTimeout(timer);
  }
}
