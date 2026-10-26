// Canada: Health Canada Drug Product Database (DPD), data extract of marketed products (a zip of
// comma-separated files without a header row). Column order, from the extract's read-me:
// https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database/read-file-drug-product-database-data-extract.html
//   drug.txt    0 DRUG_CODE, 2 CLASS, 3 DRUG_IDENTIFICATION_NUMBER, 4 BRAND_NAME
//   ingred.txt  0 DRUG_CODE, 2 INGREDIENT, 4 STRENGTH, 5 STRENGTH_UNIT
//   comp.txt    0 DRUG_CODE, 3 COMPANY_NAME, 4 COMPANY_TYPE
//   form.txt    0 DRUG_CODE, 2 PHARMACEUTICAL_FORM
//   status.txt  0 DRUG_CODE, 1 CURRENT_STATUS_FLAG, 2 STATUS

import { unzip } from "../lib/xlsx.js";
import { parseCsv } from "../lib/csv.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

export const DPD_URL = "https://www.canada.ca/content/dam/hc-sc/documents/services/drug-product-database/allfiles.zip";
const FILES = ["drug.txt", "ingred.txt", "comp.txt", "form.txt", "status.txt"];

/** Rows of one extract file grouped by DRUG_CODE (column 0). */
function byDrugCode(text) {
  const map = new Map();
  for (const r of parseCsv(text)) {
    const list = map.get(r[0]);
    if (list) list.push(r);
    else map.set(r[0], [r]);
  }
  return map;
}

// "NORTRIPTYLINE (NORTRIPTYLINE HYDROCHLORIDE)" -> "Nortriptyline"
const baseName = (s) => tidyCase(s.replace(/\s*\(.*\)\s*$/, ""));

/** Human medicines whose current status is MARKETED. Takes the five files as text. */
export function parseDpd({ drug, ingred, comp, form, status }) {
  const ingredients = byDrugCode(ingred);
  const companies = byDrugCode(comp);
  const forms = byDrugCode(form);
  const statuses = byDrugCode(status);
  const rows = [];
  for (const [code, , cls, , brandName] of parseCsv(drug)) {
    const current = (statuses.get(code) ?? []).find((s) => s[1] === "Y");
    const actives = ingredients.get(code) ?? [];
    if (cls !== "Human" || !brandName || current?.[2] !== "MARKETED" || !actives.length) continue;
    const list = companies.get(code) ?? [];
    const owner = list.find((c) => c[4] === "DIN_OWNER") ?? list[0];
    const formName = forms.get(code)?.[0]?.[2];
    rows.push({
      brand: tidyCase(brandName),
      ingredient: joinSubstances(actives.map((a) => baseName(a[2]))),
      country: "Canada",
      holder: owner?.[3] ? tidyCase(owner[3]) : undefined,
      strength: actives.map((a) => `${a[4]} ${a[5]}`.trim()).filter(Boolean).join(" / ") || undefined,
      form: formName ? tidyCase(formName) : undefined,
      status: "Marketed",
      url: `https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=${encodeURIComponent(code)}`,
    });
  }
  return rows;
}

export const dpd = {
  id: "health-canada",
  name: "Canada, Health Canada Drug Product Database",
  kind: "official",
  countries: ["Canada"],
  coverage: "Canada, marketed human drug products (Health Canada data extract)",
  homepage: "https://health-products.canada.ca/dpd-bdpp/",
  terms: "https://www.canada.ca/en/transparency/terms.html",
  // Health Canada updates the extract about once a month
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => {
    const zip = unzip(await downloadBuffer(fetchImpl, DPD_URL), FILES);
    const text = (name) => {
      if (!zip[name]) throw new Error(`Health Canada extract: ${name} missing`);
      return new TextDecoder("utf-8").decode(zip[name]);
    };
    return parseDpd({ drug: text("drug.txt"), ingred: text("ingred.txt"), comp: text("comp.txt"), form: text("form.txt"), status: text("status.txt") });
  },
};
