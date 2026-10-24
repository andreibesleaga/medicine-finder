// New Zealand: Pharmac Pharmaceutical Schedule (monthly XML; Pharmac content is CC BY 4.0). It
// lists funded (subsidised) medicines only: Chemical > Formulation > Brand.

import { decodeXml as decode } from "../lib/text.js";
import { DAY_MS, downloadText } from "./common.js";

export const PHARMAC_INDEX = "https://schedule.pharmac.govt.nz/pub/schedule/archive/";

const firstName = (xml) => decode(/<Name>([^<]*)<\/Name>/.exec(xml)?.[1]?.trim() ?? "");

/** One row per chemical, formulation and brand. */
export function parsePharmac(xml) {
  const seen = new Set();
  const rows = [];
  for (const [, chemical] of xml.matchAll(/<Chemical\b[^>]*>([\s\S]*?)<\/Chemical>/g)) {
    const ingredient = firstName(chemical);
    for (const [, formulation] of chemical.matchAll(/<Formulation\b[^>]*>([\s\S]*?)<\/Formulation>/g)) {
      const strength = firstName(formulation);
      for (const [, brandXml] of formulation.matchAll(/<Brand\b[^>]*>([\s\S]*?)<\/Brand>/g)) {
        const brand = firstName(brandXml);
        const key = `${ingredient}|${strength}|${brand}`;
        if (!brand || !ingredient || seen.has(key)) continue;
        seen.add(key);
        rows.push({ brand, ingredient, country: "New Zealand", strength: strength || undefined, status: "Funded (Pharmaceutical Schedule)" });
      }
    }
  }
  return rows;
}

export const pharmac = {
  id: "pharmac",
  name: "New Zealand, Pharmac Pharmaceutical Schedule",
  kind: "official",
  coverage: "New Zealand, funded medicines only (not every approved medicine)",
  homepage: "https://schedule.pharmac.govt.nz/",
  terms: "https://www.pharmac.govt.nz/about-this-site/copyright",
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => {
    const index = await downloadText(fetchImpl, PHARMAC_INDEX, "utf-8", 60e3);
    const latest = [...new Set(index.match(/Schedule_\d{4}-\d{2}\.xml/g) ?? [])].sort().at(-1);
    if (!latest) throw new Error("Pharmac archive: no Schedule_YYYY-MM.xml found");
    return parsePharmac(await downloadText(fetchImpl, PHARMAC_INDEX + latest));
  },
};
