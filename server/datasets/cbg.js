// Netherlands: Medicines Evaluation Board (CBG) medicines information bank, pipe-separated, UTF-8.

import { parseCsv, toRecords } from "../lib/csv.js";
import { splitProductName, tidyCase } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

export const CBG_URL = "https://www.geneesmiddeleninformatiebank.nl/metadata.csv";

export function parseCbg(text) {
  return toRecords(parseCsv(text, "|"))
    .filter((r) => r.SOORT !== "RVH" && r.PRODUCTNAAM && r.WERKZAMESTOFFEN) // RVH = homeopathic
    .map((r) => {
      const { brand, strength, form } = splitProductName(r.PRODUCTNAAM);
      return {
        brand,
        ingredient: tidyCase(joinSubstances(r.WERKZAMESTOFFEN.split("#"))),
        country: "Netherlands",
        holder: r.HANDELSVERGUNNINGHOUDER || undefined,
        strength: strength || r.POTENTIE || undefined,
        form: r.FARMACEUTISCHEVORM || form || undefined,
        status: r.AFLEVERSTATUS ? r.AFLEVERSTATUS.replace(/\$SEMICOLON\$/g, ";") : undefined,
        url: r.PRODUCTDETAIL_LINK || undefined,
      };
    });
}

export const cbg = {
  id: "cbg",
  name: "Netherlands, CBG medicines information bank",
  kind: "official",
  countries: ["Netherlands"],
  coverage: "Netherlands, authorised human medicines (no homeopathics)",
  homepage: "https://www.geneesmiddeleninformatiebank.nl/",
  terms: "https://www.geneesmiddeleninformatiebank.nl/",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseCbg(await downloadText(fetchImpl, CBG_URL)),
};
