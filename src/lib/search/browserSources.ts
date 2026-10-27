// Sources the browser can call directly (they allow cross-origin requests).

import type { MedicineResult, TrialsInfo } from "@/types/medicine";
import { BROWSER_TIMEOUT_MS } from "./config";

export type BrowserRow = Omit<MedicineResult, "id" | "sourceId" | "sourceName" | "kind">;

export interface BrowserSource {
  id: string;
  name: string;
  kind: "reference";
  homepage: string;
  /** terms of use, carried into exported files (as in NOTICE.md) */
  terms: string;
  search: (term: string, fetchImpl?: typeof fetch) => Promise<BrowserRow[]>;
}

async function getJson<T>(url: string, fetchImpl: typeof fetch, accept = "application/json"): Promise<T> {
  const res = await fetchImpl(url, { headers: { Accept: accept }, signal: AbortSignal.timeout(BROWSER_TIMEOUT_MS) });
  if (res.status === 404) return {} as T;
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface RxConcept {
  rxcui: string;
  name: string;
  tty?: string;
}

/** RxNorm (US National Library of Medicine): brand names related to the ingredient. */
export const rxnorm: BrowserSource = {
  id: "rxnorm",
  name: "RxNorm (US NLM)",
  kind: "reference",
  homepage: "https://www.nlm.nih.gov/research/umls/rxnorm/",
  terms: "https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html",
  async search(term, fetchImpl = fetch) {
    const base = "https://rxnav.nlm.nih.gov/REST";
    const ids = await getJson<{ idGroup?: { rxnormId?: string[] } }>(
      `${base}/rxcui.json?name=${encodeURIComponent(term)}&search=2`,
      fetchImpl,
    );
    const rxcui = ids.idGroup?.rxnormId?.[0];
    if (!rxcui) return [];
    const rel = await getJson<{ relatedGroup?: { conceptGroup?: { conceptProperties?: RxConcept[] }[] } }>(
      `${base}/rxcui/${rxcui}/related.json?tty=BN`,
      fetchImpl,
    );
    const concepts = (rel.relatedGroup?.conceptGroup ?? []).flatMap((g) => g.conceptProperties ?? []);
    return concepts.map((c) => ({
      brandName: c.name,
      activeIngredient: term,
      country: "United States",
      url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${c.rxcui}`,
    }));
  },
};

interface FdaLabel {
  openfda?: { brand_name?: string[]; manufacturer_name?: string[]; generic_name?: string[]; spl_set_id?: string[] };
}

/** openFDA drug labels: brand names of US products whose generic or substance name is the ingredient. */
export const openFda: BrowserSource = {
  id: "openfda",
  name: "openFDA drug labels (US FDA)",
  kind: "reference",
  homepage: "https://open.fda.gov/apis/drug/label/",
  terms: "https://open.fda.gov/terms/",
  async search(term, fetchImpl = fetch) {
    const q = `openfda.generic_name:"${term}"+openfda.substance_name:"${term}"`;
    const data = await getJson<{ results?: FdaLabel[] }>(
      `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(q).replace(/%2B/g, "+")}&limit=100`,
      fetchImpl,
    );
    const seen = new Map<string, BrowserRow>();
    for (const label of data.results ?? []) {
      const o = label.openfda;
      for (const brand of o?.brand_name ?? []) {
        const generic = o?.generic_name?.[0] ?? term;
        // skip labels whose "brand" is just the generic name
        if (same(brand, term) || same(brand, generic) || seen.has(brand.toLowerCase())) continue;
        seen.set(brand.toLowerCase(), {
          brandName: brand,
          activeIngredient: generic.toLowerCase(),
          country: "United States",
          manufacturer: o?.manufacturer_name?.[0],
          url: o?.spl_set_id?.[0] ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${o.spl_set_id[0]}` : undefined,
        });
      }
    }
    return [...seen.values()];
  },
};

interface SparqlRow {
  item: { value: string };
  itemLabel: { value: string };
  countryLabel?: { value: string };
}

/** Wikidata: items whose "has active ingredient" (P3781) is the ingredient. */
export const wikidata: BrowserSource = {
  id: "wikidata",
  name: "Wikidata",
  kind: "reference",
  homepage: "https://www.wikidata.org/",
  terms: "https://www.wikidata.org/wiki/Wikidata:Licensing",
  async search(term, fetchImpl = fetch) {
    const label = term.toLowerCase().replace(/["\\]/g, "");
    const query = `SELECT DISTINCT ?item ?itemLabel WHERE {
  ?ing rdfs:label "${label}"@en .
  ?item wdt:P3781 ?ing .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 60`;
    const data = await getJson<{ results?: { bindings?: SparqlRow[] } }>(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      fetchImpl,
      "application/sparql-results+json",
    );
    return (data.results?.bindings ?? [])
      .filter((b) => !/^Q\d+$/.test(b.itemLabel.value) && !same(b.itemLabel.value, term))
      .map((b) => ({
        brandName: b.itemLabel.value,
        activeIngredient: term,
        country: "Not stated",
        url: b.item.value,
      }));
  },
};

/** PubChem synonyms that look like brand names (one capitalised word, letters only). */
export const pubchem: BrowserSource = {
  id: "pubchem",
  name: "PubChem synonyms (US NIH)",
  kind: "reference",
  homepage: "https://pubchem.ncbi.nlm.nih.gov/",
  terms: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
  async search(term, fetchImpl = fetch) {
    const data = await getJson<{ InformationList?: { Information?: { CID: number; Synonym?: string[] }[] } }>(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(term)}/synonyms/JSON`,
      fetchImpl,
    );
    const info = data.InformationList?.Information?.[0];
    if (!info?.Synonym) return [];
    const brandLike = /^[A-Z][a-z]{3,19}$/;
    const seen = new Set<string>();
    return info.Synonym.filter((s) => brandLike.test(s) && !same(s, term))
      .filter((s) => (seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true)))
      .slice(0, 25)
      .map((s) => ({
        brandName: s,
        activeIngredient: term,
        country: "Not stated",
        status: "Synonym; may be a brand name",
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${info.CID}#section=Synonyms`,
      }));
  },
};

export const BROWSER_SOURCES: BrowserSource[] = [rxnorm, openFda, wikidata, pubchem];

/**
 * When the search server cannot be reached: the ingredient(s) of a brand name RxNorm knows (US
 * brands, "Advil" -> "ibuprofen"), or null when the term is not an RxNorm brand.
 */
export async function brandIngredient(term: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const base = "https://rxnav.nlm.nih.gov/REST";
  const ids = await getJson<{ idGroup?: { rxnormId?: string[] } }>(`${base}/rxcui.json?name=${encodeURIComponent(term)}&search=2`, fetchImpl);
  const rxcui = ids.idGroup?.rxnormId?.[0];
  if (!rxcui) return null;
  const props = await getJson<{ properties?: { tty?: string } }>(`${base}/rxcui/${rxcui}/properties.json`, fetchImpl);
  if (props.properties?.tty !== "BN") return null;
  const rel = await getJson<{ relatedGroup?: { conceptGroup?: { conceptProperties?: RxConcept[] }[] } }>(`${base}/rxcui/${rxcui}/related.json?tty=IN`, fetchImpl);
  const names = (rel.relatedGroup?.conceptGroup ?? []).flatMap((g) => g.conceptProperties ?? []).map((c) => c.name);
  // a brand of three or more substances is not searched by its ingredients (as on the server)
  return names.length && names.length <= 2 ? names.join(" + ") : null;
}

/** ClinicalTrials.gov: how many registered studies use the ingredient as an intervention. */
export async function clinicalTrials(term: string, fetchImpl: typeof fetch = fetch): Promise<TrialsInfo> {
  const data = await getJson<{ totalCount?: number }>(
    `https://clinicaltrials.gov/api/v2/studies?query.intr=${encodeURIComponent(term)}&countTotal=true&pageSize=1&fields=NCTId`,
    fetchImpl,
  );
  return {
    count: data.totalCount ?? 0,
    url: `https://clinicaltrials.gov/search?intr=${encodeURIComponent(term)}`,
  };
}
