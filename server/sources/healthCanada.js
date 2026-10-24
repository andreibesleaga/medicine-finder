// Canada: Health Canada Drug Product Database (live REST API, no key).
// API guide: https://health-products.canada.ca/api/documentation/dpd-documentation-en.html

import { fetchJson, mapLimit } from "../lib/http.js";
import { tidyCase } from "../lib/text.js";

const API = "https://health-products.canada.ca/api/drug";
const MAX_PRODUCTS = 40;

export function createHealthCanadaSource({ fetch }) {
  let lastError = null;
  return {
    id: "health-canada",
    name: "Health Canada, Drug Product Database",
    kind: "official",
    coverage: "Canada, marketed and approved drug products",
    homepage: "https://health-products.canada.ca/dpd-bdpp/",
    enabled: () => true,
    status: () => (lastError ? { state: "error", detail: lastError } : { state: "live" }),
    async search(term) {
      try {
        const ingredients = await fetchJson(
          fetch,
          `${API}/activeingredient/?lang=en&type=json&ingredientname=${encodeURIComponent(term)}`,
          { timeoutMs: 10000 },
        );
        const codes = [...new Set((Array.isArray(ingredients) ? ingredients : []).map((i) => i.drug_code))].slice(0, MAX_PRODUCTS);
        const products = await mapLimit(codes, 6, async (code) => {
          try {
            const p = await fetchJson(fetch, `${API}/drugproduct/?lang=en&type=json&id=${code}`, { timeoutMs: 10000 });
            return Array.isArray(p) ? p[0] : p;
          } catch {
            return null;
          }
        });
        lastError = null;
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
        lastError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    },
  };
}
