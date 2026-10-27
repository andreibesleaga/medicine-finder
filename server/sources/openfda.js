// United States: openFDA drug labels, queried by the server when the operator sets a free key
// (OPENFDA_API_KEY: 120,000 calls a day instead of 1,000 per address). Without the key the browser
// queries openFDA itself, as before; a key never goes to the browser. Data: public domain (CC0).

import { fetchJson } from "../lib/http.js";

const API = "https://api.fda.gov/drug/label.json";
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Brand names of US labels whose generic or substance name is the ingredient (as the browser source does). */
export function mapOpenFda(json, term) {
  const seen = new Map();
  for (const label of json?.results ?? []) {
    const o = label.openfda;
    for (const brand of o?.brand_name ?? []) {
      const generic = o?.generic_name?.[0] ?? term;
      // a label whose "brand" is just the generic name is not a brand
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
}

export function createOpenFdaSource({ fetch, env = {} }) {
  const key = () => String(env.OPENFDA_API_KEY ?? "").trim();
  return {
    id: "openfda-server",
    name: "openFDA drug labels (US FDA)",
    kind: "reference",
    coverage: "United States, product labels (queried by the server with the operator's key)",
    homepage: "https://open.fda.gov/apis/drug/label/",
    terms: "https://open.fda.gov/terms/",
    enabled: () => Boolean(key()),
    status: () => (key() ? { state: "live" } : { state: "disabled", detail: "set OPENFDA_API_KEY to enable (the browser asks openFDA meanwhile)" }),
    async search(term) {
      const q = `openfda.generic_name:"${term}"+openfda.substance_name:"${term}"`;
      const url = `${API}?search=${encodeURIComponent(q).replace(/%2B/g, "+")}&limit=100&api_key=${encodeURIComponent(key())}`;
      try {
        return mapOpenFda(await fetchJson(fetch, url, { timeoutMs: 12000 }), term);
      } catch (err) {
        // openFDA answers 404 when nothing matches
        if (err?.status === 404) return [];
        throw err;
      }
    },
  };
}
