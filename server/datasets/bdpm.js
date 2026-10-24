// France: Base de données publique des médicaments (tab-separated, ISO-8859-1).

import { splitProductName, tidyCase } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

const BASE = "https://base-donnees-publique.medicaments.gouv.fr";
export const BDPM_SPEC_URL = `${BASE}/download/file/CIS_bdpm.txt`;
export const BDPM_COMPO_URL = `${BASE}/download/file/CIS_COMPO_bdpm.txt`;

/** Marketed medicines with an active authorisation, one row per CIS code. */
export function parseBdpm(specText, compoText) {
  const substances = new Map();
  for (const line of compoText.split(/\r?\n/)) {
    const c = line.split("\t");
    if (c.length < 7 || c[6].trim() !== "SA") continue; // SA = active substance
    const cis = c[0].trim();
    if (!substances.has(cis)) substances.set(cis, []);
    substances.get(cis).push(c[3].trim());
  }
  const rows = [];
  for (const line of specText.split(/\r?\n/)) {
    const c = line.split("\t");
    if (c.length < 11) continue;
    const [cis, denomination, form, , amm, , marketed, , , , holder] = c.map((x) => x.trim());
    if (amm !== "Autorisation active" || marketed !== "Commercialisée" || !substances.has(cis)) continue;
    const { brand, strength } = splitProductName(denomination);
    rows.push({
      brand: tidyCase(brand),
      ingredient: tidyCase(joinSubstances(substances.get(cis))),
      country: "France",
      holder: holder ? tidyCase(holder) : undefined,
      strength,
      form: form || undefined,
      url: `${BASE}/medicament/${cis}/extrait`,
    });
  }
  return rows;
}

export const bdpm = {
  id: "bdpm",
  name: "France, Base de données publique des médicaments",
  kind: "official",
  coverage: "France, all marketed medicines",
  homepage: BASE,
  terms: "https://base-donnees-publique.medicaments.gouv.fr/telechargement",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => {
    const [spec, compo] = await Promise.all([
      downloadText(fetchImpl, BDPM_SPEC_URL, "latin1"),
      downloadText(fetchImpl, BDPM_COMPO_URL, "latin1"),
    ]);
    return parseBdpm(spec, compo);
  },
};
