// Ukraine: State Register of Medicinal Products (reestr.csv, ";"-separated, windows-1251; CC BY
// per data.gov.ua). Brand names are in Ukrainian; the INN column is in Latin script.

import { parseCsv, toRecords } from "../lib/csv.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

export const DRLZ_URL = "http://www.drlz.com.ua/ibp/zvity.nsf/all/zvit/$file/reestr.csv";

/** Registered finished medicines with an INN; not terminated early, substances or homeopathics. */
export function parseDrlz(records) {
  const seen = new Set();
  const rows = [];
  for (const r of records) {
    const brand = r["Торгівельне найменування"];
    const inn = r["Міжнародне непатентоване найменування"];
    const form = r["Форма випуску"] ?? "";
    if (!brand || !inn || r["Дострокове припинення"] !== "Ні" || r["Гомеопатичний ЛЗ"] === "Так") continue;
    if (/субстанц/i.test(form) || /^Субстанц/i.test(r["Фармакотерапевтична група"] ?? "")) continue;
    const key = `${brand}|${inn}|${form}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      brand: tidyCase(brand),
      ingredient: joinSubstances(inn.split(/,\s*/)),
      country: "Ukraine",
      holder: r["Заявник: назва українською"] || undefined,
      // "розчин для інфузій, 400 мг/100 мл, по 100 мл ..." -> form, then the first part with a number
      form: form.split(",")[0].trim() || undefined,
      strength: form.split(",").slice(1).map((s) => s.trim()).find((s) => /^\d/.test(s)),
      status: "Registered",
    });
  }
  return rows;
}

export const drlz = {
  id: "drlz",
  name: "Ukraine, State Register of Medicinal Products",
  kind: "official",
  coverage: "Ukraine, registered medicines (brand names in Ukrainian, ingredient as INN)",
  homepage: "https://data.gov.ua/dataset/fded13b8-4e2c-4c48-bf14-65d0e3106463",
  terms: "https://creativecommons.org/licenses/by/4.0/",
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => parseDrlz(toRecords(parseCsv(await downloadText(fetchImpl, DRLZ_URL, "windows-1251"), ";"))),
};
