// Malta: Medicines Authority export of nationally listed products (.xlsx despite the .xls name,
// updated daily). Reuse is allowed with a reference to the Medicines Authority, not for commercial
// or marketing purposes (https://medicinesauthority.gov.mt/copyright).

import { readFirstSheet } from "../lib/xlsx.js";
import { cutProductTitle, splitProductName, tidyCase, uniqueRows } from "../lib/text.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

export const MALTA_URL = "https://medicinesauthority.gov.mt/Exports/Local/AdvancedSearchResultsLocal.xls";

// cells look like " 'Efudix, cream 50 mg/g'" and headers like " [Status]"
const clean = (v) => String(v ?? "").trim().replace(/^'(.*)'$/s, "$1").trim();

// "GLICLAZIDE 80 milligram(s)" and "GLICLAZIDE  milligram(s)" -> "Gliclazide"
const UNIT_WORD = /\s+(?:(?:milli|micro)?gram|millilitre|(?:international )?unit|IU)(?:s|\(s\))?(?=[\s/]|$).*$/i;
const ingredientName = (s) => tidyCase(s.replace(/\s+\d.*$/, "").replace(UNIT_WORD, ""));

/** Authorised products. Ingredients come as "VALSARTAN 160 milligram(s) | ..." */
export function parseMaltaRows(rows) {
  const [header, ...body] = rows;
  const col = Object.fromEntries((header ?? []).map((h, i) => [clean(h).replace(/^\[|\]$/g, ""), i]));
  if (col["Medicine Name"] === undefined) throw new Error("Malta list: header row not found");
  const at = (r, name) => clean(r[col[name]]);
  const out = [];
  for (const r of body) {
    const name = at(r, "Medicine Name");
    const substances = at(r, "Active Ingredients");
    if (!name || !substances || at(r, "Status") !== "Authorised") continue;
    const { brand, strength } = splitProductName(name);
    out.push({
      brand: cutProductTitle(brand),
      ingredient: joinSubstances(substances.split(" | ").map(ingredientName)),
      country: "Malta",
      holder: at(r, "Authorization Holder") || undefined,
      strength,
      form: tidyCase(at(r, "Pharmaceutical Forms")) || undefined,
      status: "Authorised",
    });
  }
  return uniqueRows(out);
}

export const maltama = {
  id: "malta-ma",
  name: "Malta, Medicines Authority national products",
  kind: "official",
  coverage: "Malta, authorised medicines (national list)",
  homepage: "https://medicinesauthority.gov.mt/advanced-search",
  terms: "https://medicinesauthority.gov.mt/copyright",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseMaltaRows(readFirstSheet(await downloadBuffer(fetchImpl, MALTA_URL))),
};
