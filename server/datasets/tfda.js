// Taiwan: TFDA open data set 36, all drug licences (a zip with one JSON array; Open Government
// Data License, Taiwan, compatible with CC BY 4.0). Field names are Chinese:
//   英文品名 English name, 中文品名 Chinese name, 主成分略述 ingredients (English, ";;"-separated),
//   申請商名稱 licence holder, 劑型 dosage form, 許可證種類 licence type, 註銷狀態 cancellation status,
//   有效日期 valid until (YYYY/MM/DD)

import { unzip } from "../lib/xlsx.js";
import { cutProductTitle, splitProductName, tidyCase, uniqueRows } from "../lib/text.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

export const TFDA_URL = "https://data.fda.gov.tw/data/opendata/export/36/json";
// finished preparations and biologics; not raw materials, test reagents or supplies
const PRODUCT_TYPES = new Set(["製　劑", "菌　疫"]);

// "Acetaminophen (Eq To Paracetamol)" -> "Acetaminophen"; "Melitracen Hcl" -> "Melitracen Hydrochloride"
const substanceName = (s) => tidyCase(s.replace(/\s*\(\s*eq\b[^)]*\)?/gi, "")).replace(/\bhcl\b/gi, "Hydrochloride");
// the manufacturer tag after the name: 'Phenamin Injection "lita"', 'Jexit S.c. Tablets“johnson”', or an unbalanced '"n.y.';
// a name that starts with the quoted tag ('"BenQ" A25 Hemodialysis') only loses the quotes
const QUOTES = /["“”]/;
const withoutTag = (s) => (QUOTES.test(s[0]) ? s.replace(/["“”]/g, " ").replace(/\s+/g, " ").trim() : s.replace(/\s*["“”].*$/, ""));

/** Licences that are not cancelled (註銷狀態 empty) and valid on `today`, for finished products. */
export function parseTfda(items, today = new Date()) {
  const todayText = today.toISOString().slice(0, 10).replace(/-/g, "/");
  const rows = [];
  for (const d of items) {
    const name = (d["英文品名"] || d["中文品名"] || "").trim();
    const substances = (d["主成分略述"] || "").split(";;").filter((s) => s.trim());
    if (d["註銷狀態"] || (d["有效日期"] && d["有效日期"] < todayText) || !PRODUCT_TYPES.has(d["許可證種類"]) || !name || !substances.length) continue;
    const { strength } = splitProductName(withoutTag(name));
    rows.push({
      brand: tidyCase(cutProductTitle(withoutTag(name))),
      ingredient: joinSubstances(substances.map(substanceName)),
      country: "Taiwan",
      holder: d["申請商名稱"] || undefined,
      strength,
      form: d["劑型"] || undefined,
      status: "Licensed",
    });
  }
  return uniqueRows(rows);
}

export const tfda = {
  id: "tfda",
  name: "Taiwan, TFDA drug licences",
  kind: "official",
  coverage: "Taiwan, licensed medicines (finished products and biologics, not cancelled or expired)",
  homepage: "https://data.gov.tw/dataset/9122",
  terms: "https://data.gov.tw/license",
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => {
    const files = unzip(await downloadBuffer(fetchImpl, TFDA_URL), ["36_5.json"]);
    if (!files["36_5.json"]) throw new Error("TFDA zip: 36_5.json missing");
    return parseTfda(JSON.parse(files["36_5.json"].toString("utf8")));
  },
};
