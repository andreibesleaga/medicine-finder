// Poland: register of medicinal products (URPL), semicolon CSV with quotes, UTF-8.

import { parseCsv, toRecords } from "../lib/csv.js";
import { DAY_MS, downloadText } from "./common.js";

export const URPL_URL = "https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/get-csv";

export function parseUrpl(text) {
  return toRecords(parseCsv(text, ";"))
    .filter((r) => r["Rodzaj preparatu"] === "Ludzki" && r["Nazwa Produktu Leczniczego"])
    .map((r) => {
      const validity = r["Ważność pozwolenia"];
      return {
        brand: r["Nazwa Produktu Leczniczego"],
        // the common (INN, Latin) name, e.g. "Ibuprofenum"
        ingredient: r["Nazwa powszechnie stosowana"] || r["Substancja czynna"],
        country: "Poland",
        holder: r["Podmiot odpowiedzialny"] || undefined,
        strength: r.Moc || undefined,
        form: r["Postać farmaceutyczna"] || undefined,
        status: validity === "Bezterminowe" ? "Authorised (no expiry)" : validity ? `Authorised until ${validity}` : undefined,
        url: r.Charakterystyka || r.Ulotka || undefined,
      };
    })
    .filter((r) => r.ingredient);
}

export const urpl = {
  id: "urpl",
  name: "Poland, Register of Medicinal Products (URPL)",
  kind: "official",
  countries: ["Poland"],
  coverage: "Poland, authorised human medicines",
  homepage: "https://rejestry.ezdrowie.gov.pl/rpl/search/public",
  terms: "https://rejestry.ezdrowie.gov.pl/",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseUrpl(await downloadText(fetchImpl, URPL_URL)),
};
