// United States: FDA National Drug Code (NDC) Directory, finished products (ndctext.zip, updated
// daily; tab-separated product.txt with a header row). Public domain (openFDA: CC0).

import { unzip } from "../lib/xlsx.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

export const NDC_URL = "https://www.accessdata.fda.gov/cder/ndctext.zip";
const HUMAN = new Set(["HUMAN PRESCRIPTION DRUG", "HUMAN OTC DRUG"]);

/** Human prescription and OTC products still marketed and not excluded from the directory. */
export function parseNdcProducts(text) {
  const [header, ...lines] = text.split(/\r?\n/);
  const col = Object.fromEntries(header.split("\t").map((name, i) => [name, i]));
  const seen = new Set();
  const rows = [];
  for (const line of lines) {
    const f = line.split("\t");
    const brand = f[col.PROPRIETARYNAME]?.trim();
    const substances = f[col.SUBSTANCENAME]?.trim();
    if (!brand || !substances || !HUMAN.has(f[col.PRODUCTTYPENAME])) continue;
    if (f[col.NDC_EXCLUDE_FLAG] !== "N" || f[col.ENDMARKETINGDATE]) continue;
    const holder = f[col.LABELERNAME]?.trim();
    const strengths = f[col.ACTIVE_NUMERATOR_STRENGTH].split(";").map((s) => s.trim());
    const units = f[col.ACTIVE_INGRED_UNIT].split(";").map((s) => s.trim());
    const strength = strengths.map((s, i) => `${s} ${units[i] ?? ""}`.trim()).filter(Boolean).join(" / ");
    const key = `${brand}|${holder}|${substances}|${strength}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      // a few labelers write names in lower case ("good sense ibuprofen pm")
      brand: tidyCase(brand === brand.toLowerCase() ? brand.toUpperCase() : brand),
      ingredient: joinSubstances(substances.split(";").map(tidyCase)),
      country: "United States",
      holder: holder || undefined,
      strength: strength || undefined,
      form: tidyCase(f[col.DOSAGEFORMNAME] ?? "") || undefined,
      status: f[col.PRODUCTTYPENAME] === "HUMAN OTC DRUG" ? "Listed, over the counter" : "Listed, prescription",
    });
  }
  return rows;
}

export const usfda = {
  id: "us-fda-ndc",
  name: "United States, FDA National Drug Code Directory",
  kind: "official",
  coverage: "United States, marketed human prescription and OTC drugs (finished products)",
  homepage: "https://www.fda.gov/drugs/drug-approvals-and-databases/national-drug-code-directory",
  terms: "https://open.fda.gov/terms/",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => {
    const zip = unzip(await downloadBuffer(fetchImpl, NDC_URL), ["product.txt"]);
    if (!zip["product.txt"]) throw new Error("NDC zip: product.txt missing");
    return parseNdcProducts(new TextDecoder("utf-8").decode(zip["product.txt"]));
  },
};
