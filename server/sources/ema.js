// European Medicines Agency: all centrally authorised human medicines (official JSON report, refreshed daily).

import { fetchJson } from "../lib/http.js";
import { normalize, stems, matchesSubstance } from "../lib/text.js";
import { Dataset } from "./dataset.js";

export const EMA_URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json";

/** Keeps the fields we use from the EMA report rows (human medicines only). */
export function indexEma(json) {
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows
    .filter((r) => r.category === "Human" && r.name_of_medicine)
    .map((r) => ({
      name: r.name_of_medicine.trim(),
      substance: r.active_substance || r.international_non_proprietary_name_common_name || "",
      inn: r.international_non_proprietary_name_common_name || "",
      status: r.medicine_status || "",
      holder: r.marketing_authorisation_developer_applicant_holder || "",
      url: r.medicine_url || "",
      generic: r.generic === "Yes",
    }));
}

export function createEmaSource({ fetch, refreshMs = 24 * 3600e3, now }) {
  const dataset = new Dataset({
    refreshMs,
    now,
    load: async () => indexEma(await fetchJson(fetch, EMA_URL, { timeoutMs: 60000 })),
  });

  return {
    id: "ema",
    name: "European Medicines Agency (EMA)",
    kind: "official",
    coverage: "European Union, centrally authorised medicines",
    homepage: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
    dataset,
    enabled: () => true,
    status: () => dataset.status(),
    async search(term) {
      const rows = await dataset.ready(15000);
      if (!rows) throw new Error("EMA data is still loading");
      const s = stems(term);
      const t = normalize(term);
      return rows
        // only medicines currently authorised; withdrawn or refused ones would mislead
        .filter((r) => r.status === "Authorised")
        .filter((r) => matchesSubstance(s, r.substance) || matchesSubstance(s, r.inn) || normalize(r.name).includes(t))
        .map((r) => ({
          brandName: r.name,
          activeIngredient: r.substance || r.inn || term,
          country: "European Union",
          manufacturer: r.holder || undefined,
          status: r.status || undefined,
          url: r.url || undefined,
        }));
    },
  };
}
