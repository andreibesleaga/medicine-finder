// Ukraine: State Register of Medicinal Products (reestr.csv, ";"-separated, windows-1251; CC BY
// per data.gov.ua). Brand names are in Ukrainian; the INN column is in Latin script. The form and
// strength are cut out of the pack text; "combinations" parts of ATC-style INN names are dropped.

import { parseCsv, toRecords } from "../lib/csv.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

export const DRLZ_URL = "http://www.drlz.com.ua/ibp/zvity.nsf/all/zvit/$file/reestr.csv";

// "Форма випуску" is the whole pack text: "таблетки, вкриті оболонкою, 20 мг, по 10 таблеток у блістері"
const FORM_END = /\s+по\s|\s+in bulk|\d/i;
const UNIT = "(?:мкг|мг|мл|мо|г|%)";
const STRENGTH = new RegExp(`\\d[\\d.,]*\\s*${UNIT}(?:/[\\d.,]*\\s*${UNIT})*`, "gi");

function shortForm(text) {
  const end = text.search(FORM_END);
  return (end < 0 ? text : text.slice(0, end)).replace(/[\s,;]+$/, "");
}

// first dose such as "400 мг/100 мл"; a bare pack size ("по 20 г", "по 5 мл") is not a strength
function shortStrength(text) {
  const isPackSize = (m) => /^[\d.,\s]+(?:г|мл)$/i.test(m[0]) && /по\s+$/.test(text.slice(0, m.index));
  return [...text.matchAll(STRENGTH)].find((m) => !isPackSize(m))?.[0];
}

// INN column holds ATC names: "Diclofenac, combinations" -> "Diclofenac"; "A and B" -> two
const innParts = (inn) => inn.split(/,\s*|\s+and\s+/).filter((p) => !/combination/i.test(p));

/** Registered finished medicines with an INN; not terminated early, substances or homeopathics. */
export function parseDrlz(records) {
  const seen = new Set();
  const rows = [];
  for (const r of records) {
    // some brands carry the pack text: "Аккофіл, По 480 Мкг/0,5 Мл У ..."
    const brand = r["Торгівельне найменування"]?.split(/,\s*по\s/i)[0].trim();
    const inn = joinSubstances(innParts(r["Міжнародне непатентоване найменування"] ?? ""));
    const form = r["Форма випуску"] ?? "";
    if (!brand || !inn || r["Дострокове припинення"] !== "Ні" || r["Гомеопатичний ЛЗ"] === "Так") continue;
    if (/[cс]убстанц/i.test(form) || /^Субстанц/i.test(r["Фармакотерапевтична група"] ?? "")) continue;
    const strength = shortStrength(form);
    const key = `${brand}|${inn}|${r["Заявник: назва українською"]}|${strength}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      brand: tidyCase(brand),
      ingredient: inn,
      country: "Ukraine",
      holder: r["Заявник: назва українською"] || undefined,
      form: shortForm(form) || undefined,
      strength,
      status: "Registered",
    });
  }
  return rows;
}

export const drlz = {
  id: "drlz",
  name: "Ukraine, State Register of Medicinal Products",
  kind: "official",
  countries: ["Ukraine"],
  coverage: "Ukraine, registered medicines (brand names in Ukrainian, ingredient as INN)",
  homepage: "https://data.gov.ua/dataset/fded13b8-4e2c-4c48-bf14-65d0e3106463",
  terms: "https://creativecommons.org/licenses/by/4.0/",
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => parseDrlz(toRecords(parseCsv(await downloadText(fetchImpl, DRLZ_URL, "windows-1251"), ";"))),
};
