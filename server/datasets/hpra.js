// Ireland: HPRA list of authorised human medicines (XML).

import { decodeXml as decode, splitProductName } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

export const HPRA_URL = "https://www.hpra.ie/img/uploaded/swedocuments/latestHMlist.xml";

const tag = (xml, name) => {
  const m = new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml);
  return m ? decode(m[1].trim()) : "";
};
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "g"))].map((m) => decode(m[1].trim()));

/** Authorised products, except those the HPRA lists as not marketed. */
export function parseHpra(xml) {
  const rows = [];
  for (const m of xml.matchAll(/<(?:\w+:)?Product>([\s\S]*?)<\/(?:\w+:)?Product>/g)) {
    const p = m[1];
    const market = tag(p, "MarketInfo");
    const name = tag(p, "ProductName");
    const substances = tags(p, "ActiveSubstance");
    if (market === "Not marketed" || !name || !substances.length) continue;
    const { brand, strength } = splitProductName(name);
    rows.push({
      brand,
      ingredient: joinSubstances(substances),
      country: "Ireland",
      holder: tag(p, "PAHolder") || undefined,
      strength,
      form: tag(p, "DosageForm") || undefined,
      status: market === "Marketed" ? "Authorised, marketed" : "Authorised",
    });
  }
  return rows;
}

export const hpra = {
  id: "hpra",
  name: "Ireland, HPRA authorised medicines",
  kind: "official",
  countries: ["Ireland"],
  coverage: "Ireland, authorised human medicines (not those marked not marketed)",
  homepage: "https://www.hpra.ie/find-a-medicine",
  terms: "https://www.hpra.ie/",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseHpra(await downloadText(fetchImpl, HPRA_URL)),
};
