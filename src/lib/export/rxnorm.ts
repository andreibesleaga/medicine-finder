// RxNorm concept ids (RxCUI) for ingredient names, from the US National Library of Medicine's
// RxNav API (no key; NLM attribution in every file that uses them). Looked up once per name when a
// FHIR file is made, never per search; a name RxNorm does not know keeps only its text.

import { BROWSER_TIMEOUT_MS } from "@/lib/search/config";

export const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";

// one file looks up at most this many distinct names (RxNav allows 20 requests a second per address),
// each for at most LOOKUP_TIMEOUT_MS, and none is started after DEADLINE_MS: a slow RxNav never holds
// the download for long (the file is made without the codes not found in time)
export const MAX_LOOKUPS = 40;
const CONCURRENCY = 4;
const LOOKUP_TIMEOUT_MS = 4000;
const DEADLINE_MS = 15000;

const cache = new Map<string, string | null>();

/**
 * Substance names of an ingredient text. Only "+", ";" and "|" separate: commas and "and" also occur
 * inside one name ("influenza vaccine, inactivated"), so such text stays whole.
 */
export function substances(ingredient: string): string[] {
  return [
    ...new Set(
      ingredient
        .split(/\s*[+;|]\s*/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

async function lookup(name: string, fetchImpl: typeof fetch): Promise<string | null> {
  const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=2`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(Math.min(LOOKUP_TIMEOUT_MS, BROWSER_TIMEOUT_MS)) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { idGroup?: { rxnormId?: string[] } };
  return body.idGroup?.rxnormId?.[0] ?? null;
}

/**
 * RxCUI by lower-case name. Names not found, past the limit, or whose lookup failed are left out;
 * a failed lookup is not remembered, so the next file tries again.
 */
export async function rxcuis(names: string[], fetchImpl: typeof fetch = fetch, now: () => number = Date.now): Promise<Map<string, string>> {
  const wanted = [...new Set(names.map((n) => n.toLowerCase()))].slice(0, MAX_LOOKUPS);
  const todo = wanted.filter((n) => !cache.has(n));
  const stopAt = now() + DEADLINE_MS;
  let next = 0;
  const worker = async () => {
    while (next < todo.length && now() < stopAt) {
      const name = todo[next++];
      try {
        cache.set(name, await lookup(name, fetchImpl));
      } catch {
        // network error or RxNav down: the file is made without this code
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const out = new Map<string, string>();
  for (const n of wanted) {
    const id = cache.get(n);
    if (id) out.set(n, id);
  }
  return out;
}

/** Empties the cache (tests). */
export function clearRxnormCache() {
  cache.clear();
}
