// Singapore: HSA listing of registered therapeutic products on data.gov.sg (CSV; Singapore Open
// Data Licence v1.0). The download link is signed and short-lived, so it is requested each time.

import { parseCsv, toRecords } from "../lib/csv.js";
import { splitProductName, tidyCase } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";
import { fetchJson } from "../lib/http.js";

export const HSA_POLL_URL = "https://api-open.data.gov.sg/v1/public/api/datasets/d_767279312753558cbf19d48344577084/poll-download";
// "FUCON CAPSULE" -> "FUCON": a dosage form word at the end of the name is not part of the brand
const TRAILING_FORM = /\s+(?:FILM[- ]COATED\s+)?(?:TABLETS?|CAPSULES?|INJECTION|SOLUTION|SYRUP|CREAM|OINTMENT|GEL|SUSPENSION|GRANULES|POWDER|(?:EYE |EAR )?DROPS)$/i;

export function parseHsa(records) {
  return records
    .filter((r) => r.Productname && r.Activeingredients)
    .map((r) => {
      const { brand } = splitProductName(r.Productname);
      return {
        brand: tidyCase(brand.replace(TRAILING_FORM, "") || brand),
        ingredient: joinSubstances(r.Activeingredients.split("&&").map(tidyCase)),
        country: "Singapore",
        holder: r.Licenseholder ? tidyCase(r.Licenseholder) : undefined,
        strength: r.Strength ? r.Strength.split("&&").join(" / ") : undefined,
        form: r.Dosageform ? tidyCase(r.Dosageform) : undefined,
        status: "Registered",
      };
    });
}

export const hsa = {
  id: "hsa",
  name: "Singapore, HSA registered therapeutic products",
  kind: "official",
  coverage: "Singapore, registered therapeutic products",
  homepage: "https://data.gov.sg/datasets/d_767279312753558cbf19d48344577084/view",
  terms: "https://data.gov.sg/open-data-licence",
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => {
    const poll = await fetchJson(fetchImpl, HSA_POLL_URL, { timeoutMs: 30000 });
    const url = poll?.data?.url;
    if (!url) throw new Error("data.gov.sg: no download link in the answer");
    return parseHsa(toRecords(parseCsv(await downloadText(fetchImpl, url))));
  },
};
