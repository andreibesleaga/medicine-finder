// European Medicines Agency: centrally authorised human medicines (official JSON report).

import { fetchJson } from "../lib/http.js";
import { DAY_MS, joinSubstances } from "./common.js";

export const EMA_URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json";

export function parseEma(json) {
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows
    .filter((r) => r.category === "Human" && r.medicine_status === "Authorised" && r.name_of_medicine)
    .map((r) => ({
      brand: r.name_of_medicine.trim(),
      ingredient: joinSubstances((r.active_substance ?? "").split(";")) || r.international_non_proprietary_name_common_name || "",
      country: "European Union",
      holder: r.marketing_authorisation_developer_applicant_holder || undefined,
      status: "Authorised",
      url: r.medicine_url || undefined,
    }))
    .filter((r) => r.ingredient);
}

export const ema = {
  id: "ema",
  name: "European Medicines Agency (EMA)",
  kind: "official",
  coverage: "European Union, centrally authorised medicines",
  homepage: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
  terms: "https://www.ema.europa.eu/en/about-us/legal-notice",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseEma(await fetchJson(fetchImpl, EMA_URL, { timeoutMs: 5 * 60e3 })),
};
