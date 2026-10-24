// Canada: Health Canada Drug Product Database, live REST API (no key). The same data also comes
// from Health Canada's monthly extract (server/datasets/dpd.js), which answers even when this API
// is down. HEALTH_CANADA picks which of the two the server uses.
// API guide: https://health-products.canada.ca/api/documentation/dpd-documentation-en.html

import { fetchJson, mapLimit, UpstreamError } from "../lib/http.js";
import { tidyCase } from "../lib/text.js";
import { withSynonyms } from "../lib/synonyms.js";

const API = "https://health-products.canada.ca/api/drug";
const MAX_PRODUCTS = 40;

export const HEALTH_CANADA_MODES = {
  dataset: { dataset: true, live: false },
  live: { dataset: false, live: true },
  both: { dataset: true, live: true },
  off: { dataset: false, live: false },
};

/** Reads HEALTH_CANADA ("dataset" by default; "live", "both" or "off"). */
export function healthCanadaMode(value, log = () => {}) {
  const key = String(value ?? "").trim().toLowerCase() || "dataset";
  if (HEALTH_CANADA_MODES[key]) return HEALTH_CANADA_MODES[key];
  log(`HEALTH_CANADA="${value}" is not one of ${Object.keys(HEALTH_CANADA_MODES).join(", ")}; using dataset`);
  return HEALTH_CANADA_MODES.dataset;
}

/** True when Health Canada's side failed (5xx, timeout, network), not the request. */
const theirOutage = (err) => !(err instanceof UpstreamError) || err.status >= 500;

export function createHealthCanadaSource({ fetch }) {
  let last = null;
  return {
    id: "health-canada-live",
    name: "Health Canada, Drug Product Database (live API)",
    kind: "official",
    coverage: "Canada, marketed and approved drug products",
    homepage: "https://health-products.canada.ca/dpd-bdpp/",
    enabled: () => true,
    status: () => last ?? { state: "live" },
    async search(term) {
      try {
        const found = [];
        for (const name of withSynonyms(term)) {
          const list = await fetchJson(
            fetch,
            `${API}/activeingredient/?lang=en&type=json&ingredientname=${encodeURIComponent(name)}`,
            { timeoutMs: 10000 },
          );
          if (Array.isArray(list)) found.push(...list);
        }
        const codes = [...new Set(found.map((i) => i.drug_code))].slice(0, MAX_PRODUCTS);
        const products = await mapLimit(codes, 6, async (code) => {
          try {
            const p = await fetchJson(fetch, `${API}/drugproduct/?lang=en&type=json&id=${code}`, { timeoutMs: 10000 });
            return Array.isArray(p) ? p[0] : p;
          } catch {
            return null;
          }
        });
        last = null;
        return products
          .filter((p) => p && p.brand_name)
          .map((p) => ({
            brandName: tidyCase(p.brand_name),
            activeIngredient: term,
            country: "Canada",
            manufacturer: p.company_name ? tidyCase(p.company_name) : undefined,
            status: p.class_name || undefined,
            url: `https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=${encodeURIComponent(p.drug_code)}`,
          }));
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        if (!theirOutage(err)) {
          last = { state: "error", detail };
          throw err;
        }
        // reported as "not available" rather than "failed": the problem is on Health Canada's side
        last = { state: "unavailable", detail: `Health Canada's API is not answering (${detail})` };
        throw Object.assign(new Error(last.detail), { unavailable: true });
      }
    },
  };
}
