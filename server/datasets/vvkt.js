// Lithuania: VVKT register of medicinal products on the national open data portal (CSV, one row
// per package; CC BY 4.0).

import { parseCsv, toRecords } from "../lib/csv.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

export const VVKT_URL = "https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote/:format/csv";
// stadija: registered or re-registered; not deregistered (Išregistruotas) or suspended (Sustabdytas)
const CURRENT = new Set(["Registruotas", "Perregistruotas"]);

/** One row per product (vid); "supplied" when any of its packages is on the market. */
export function parseVvkt(records) {
  const byProduct = new Map();
  for (const r of records) {
    if (!CURRENT.has(r.stadija) || !r.preparato_pav || !r.veikl_angl_pavad) continue;
    const p = byProduct.get(r.vid);
    if (p) {
      if (r.pak_tiekimo_busena === "Tiekiama") p.status = "Registered, supplied";
      continue;
    }
    byProduct.set(r.vid, {
      brand: r.preparato_pav,
      // "Valsartan, amlodipine and hydrochlorothiazide"
      ingredient: joinSubstances(r.veikl_angl_pavad.split(/,\s*|\s+and\s+/)),
      country: "Lithuania",
      holder: r.registruotojas || undefined,
      strength: r.stiprumas || undefined,
      form: r.farmacine_forma_lt || undefined,
      status: r.pak_tiekimo_busena === "Tiekiama" ? "Registered, supplied" : "Registered",
    });
  }
  return [...byProduct.values()];
}

export const vvkt = {
  id: "vvkt",
  name: "Lithuania, VVKT register of medicinal products",
  kind: "official",
  coverage: "Lithuania, registered medicinal products",
  homepage: "https://data.gov.lt/datasets/2853/",
  terms: "https://creativecommons.org/licenses/by/4.0/",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => {
    // the portal's gateway often answers 502 once and then serves the file: try a second time
    const text = await downloadText(fetchImpl, VVKT_URL).catch((err) => {
      if (err?.status >= 500) return downloadText(fetchImpl, VVKT_URL);
      throw err;
    });
    return parseVvkt(toRecords(parseCsv(text)));
  },
};
