// Italy: AIFA list of authorised packs (semicolon CSV, UTF-8).

import { parseCsv, toRecords } from "../lib/csv.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

export const AIFA_URL = "https://drive.aifa.gov.it/farmaci/confezioni.csv";

const STRENGTH = /^\s*(\d[\d.,]*\s*(?:MG|G|MCG|µG|ML|UI|U\.I\.|%|MMOL)(?:\s*\/\s*[\d.,]*\s*(?:MG|G|ML|DOSE|H))?)/i;

/** One row per medicine and strength (packs of the same strength are merged). */
export function parseAifa(text) {
  const seen = new Set();
  const rows = [];
  for (const r of toRecords(parseCsv(text, ";"))) {
    if (r.STATO_AMMINISTRATIVO !== "Autorizzata" || !r.DENOMINAZIONE || !r.PA_ASSOCIATI) continue;
    const strength = STRENGTH.exec(r.DESCRIZIONE)?.[1]?.replace(/\s+/g, " ").toLowerCase();
    const key = `${r.COD_FARMACO}|${strength ?? ""}|${r.FORMA}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      brand: tidyCase(r.DENOMINAZIONE),
      ingredient: tidyCase(joinSubstances(r.PA_ASSOCIATI.split("/"))),
      country: "Italy",
      holder: r.RAGIONE_SOCIALE ? tidyCase(r.RAGIONE_SOCIALE) : undefined,
      strength,
      form: r.FORMA || undefined,
      status: "Authorised",
    });
  }
  return rows;
}

export const aifa = {
  id: "aifa",
  name: "Italy, AIFA authorised medicines",
  kind: "official",
  coverage: "Italy, authorised medicine packs",
  homepage: "https://www.aifa.gov.it/liste-dei-farmaci",
  terms: "https://www.aifa.gov.it/en/open-data",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseAifa(await downloadText(fetchImpl, AIFA_URL)),
};
