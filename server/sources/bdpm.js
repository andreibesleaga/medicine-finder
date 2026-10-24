// France: Base de données publique des médicaments (ANSM / Ministry of Health), refreshed daily.
// Files are tab-separated, ISO-8859-1. Columns: https://base-donnees-publique.medicaments.gouv.fr/telechargement

import { fetchChecked } from "../lib/http.js";
import { stems, matchesSubstance, splitProductName, tidyCase } from "../lib/text.js";
import { Dataset } from "./dataset.js";

const BASE = "https://base-donnees-publique.medicaments.gouv.fr";
export const BDPM_SPEC_URL = `${BASE}/download/file/CIS_bdpm.txt`;
export const BDPM_COMPO_URL = `${BASE}/download/file/CIS_COMPO_bdpm.txt`;

async function fetchLatin1(fetchImpl, url) {
  const res = await fetchChecked(fetchImpl, url, { timeoutMs: 60000 });
  return new TextDecoder("latin1").decode(await res.arrayBuffer());
}

/**
 * Builds { products: Map<cis, product>, substances: Array<{ name, cis: string[] }> } from the two files.
 * Only medicines with an active authorisation that are marketed are kept.
 */
export function indexBdpm(specText, compoText) {
  const products = new Map();
  for (const line of specText.split(/\r?\n/)) {
    const c = line.split("\t");
    if (c.length < 11) continue;
    const [cis, denomination, form, , amm, , marketed, , , , holder] = c;
    if (amm.trim() !== "Autorisation active" || marketed.trim() !== "Commercialisée") continue;
    products.set(cis.trim(), { denomination: denomination.trim(), form: form.trim(), holder: holder.trim() });
  }
  const bySubstance = new Map();
  for (const line of compoText.split(/\r?\n/)) {
    const c = line.split("\t");
    if (c.length < 7) continue;
    const cis = c[0].trim();
    const name = c[3].trim();
    // "SA" = active substance; "FT" = therapeutic fraction (a salt's base), counted too
    if (!products.has(cis) || !name || !["SA", "FT"].includes(c[6].trim())) continue;
    if (!bySubstance.has(name)) bySubstance.set(name, new Set());
    bySubstance.get(name).add(cis);
  }
  const substances = [...bySubstance].map(([name, set]) => ({ name, cis: [...set] }));
  return { products, substances };
}

export function createBdpmSource({ fetch, refreshMs = 24 * 3600e3, now }) {
  const dataset = new Dataset({
    refreshMs,
    now,
    load: async () => {
      const [spec, compo] = await Promise.all([fetchLatin1(fetch, BDPM_SPEC_URL), fetchLatin1(fetch, BDPM_COMPO_URL)]);
      const index = indexBdpm(spec, compo);
      if (index.products.size === 0) throw new Error("BDPM files were empty or in an unexpected format");
      return index;
    },
  });

  return {
    id: "bdpm",
    name: "France, Base de données publique des médicaments",
    kind: "official",
    coverage: "France, all marketed medicines",
    homepage: BASE,
    dataset,
    enabled: () => true,
    status: () => dataset.status(),
    async search(term) {
      const index = await dataset.ready(15000);
      if (!index) throw new Error("French data is still loading");
      const s = stems(term);
      const seen = new Map();
      for (const sub of index.substances) {
        if (!matchesSubstance(s, sub.name)) continue;
        for (const cis of sub.cis) {
          const p = index.products.get(cis);
          if (!p || seen.has(cis)) continue;
          const { brand, strength } = splitProductName(p.denomination);
          seen.set(cis, {
            brandName: tidyCase(brand),
            activeIngredient: tidyCase(sub.name),
            country: "France",
            manufacturer: p.holder ? tidyCase(p.holder) : undefined,
            strength,
            dosageForm: p.form || undefined,
            url: `${BASE}/medicament/${cis}/extrait`,
          });
        }
      }
      return [...seen.values()];
    },
  };
}
