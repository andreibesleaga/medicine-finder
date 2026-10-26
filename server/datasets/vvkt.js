// Lithuania: VVKT register of medicinal products on the national open data portal (CSV, one row
// per package; CC BY 4.0). Parallel imports and distribution are left out (the original product is
// listed); the ingredient comes from the ATC name (7-character codes) or the Lithuanian substance column.

import { parseCsv, toRecords } from "../lib/csv.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

export const VVKT_URL = "https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote/:format/csv";
// stadija: registered or re-registered; not deregistered (Išregistruotas) or suspended (Sustabdytas)
const CURRENT = new Set(["Registruotas", "Perregistruotas"]);
// tiekimo_lr_rinkai_pagr: parallel import and parallel distribution
const PARALLEL = new Set(["Lygiagretus importas", "CR-Lygiagretus platinimas"]);

/**
 * Substances of a product. A 7-character ATC code names one substance or a combination in English
 * ("Paracetamol, combinations excl. psycholeptics" -> "Paracetamol"); shorter codes name a group
 * ("Iron, parenteral preparations"), so the Lithuanian substances ("A/B", no ATC: skipped) are used.
 */
function substances(r) {
  const atc = r.atc_kodas ?? "";
  if (atc.length !== 7) return atc ? (r.veiklioji_medz_lt ?? "").split("/") : [];
  const name = (r.veikl_angl_pavad ?? "").replace(/,\s*combinations.*$| in combination.*$/i, "");
  // vaccine names contain commas ("influenza, inactivated, split virus"): keep whole
  return atc.startsWith("J07") ? [name] : name.split(/,\s*|\s+and\s+/);
}

/** One row per product (vid); "supplied" when any of its packages is on the market. */
export function parseVvkt(records) {
  const byProduct = new Map();
  for (const r of records) {
    if (!CURRENT.has(r.stadija) || !r.preparato_pav || PARALLEL.has(r.tiekimo_lr_rinkai_pagr)) continue;
    const p = byProduct.get(r.vid);
    if (p) {
      if (r.pak_tiekimo_busena === "Tiekiama") p.status = "Registered, supplied";
      continue;
    }
    const ingredient = joinSubstances(substances(r));
    if (!ingredient) continue;
    byProduct.set(r.vid, {
      brand: r.preparato_pav,
      ingredient,
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
  countries: ["Lithuania"],
  coverage: "Lithuania, registered medicinal products (not parallel imports)",
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
