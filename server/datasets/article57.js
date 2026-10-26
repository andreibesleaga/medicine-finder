// EEA countries without a national dataset here: EMA's public extract of the Article 57 database
// (every medicine authorised in the EU/EEA, as reported by the licence holders; one .xlsx, updated
// about monthly). EMA's legal notice allows reuse, commercial too, "provided that EMA is always
// acknowledged as the source of the material".
// Columns used: product name (the brand, or "generic name + company"), active substance, product
// authorisation country, marketing authorisation holder. The pharmacovigilance contact columns
// (e-mail, phone) are never read.

import { readFirstSheet } from "../lib/xlsx.js";
import { normalize, stems } from "../lib/text.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

export const ARTICLE57_URL = "https://www.ema.europa.eu/en/documents/other/article-57-product-data_en.xlsx";

// countries that have their own, richer dataset (or live source) here: their rows are skipped, as
// are EU-wide authorisations (the EMA medicines report already lists them)
export const SKIPPED_COUNTRIES = new Set(
  [
    "European Union", "France", "Italy", "Poland", "Netherlands", "Ireland", "Czech Republic", "Denmark", "Sweden",
    "Finland", "Lithuania", "Malta", "Spain",
  ].map((c) => c.toLowerCase()),
);

// the extract's name for products authorised under EU law in Northern Ireland
const NORTHERN_IRELAND = "United Kingdom (Northern Ireland)";

/**
 * Substances of one product. "|" separates the products of a combination pack; within one, ", "
 * separates substances, except in herbal preparations whose single substance description has
 * commas of its own ("Soft Extract Of Capsicum, (4-7: 1), … Extraction Solvent: Ethanol 80% (V/V)").
 */
export function article57Substances(text) {
  return text.split("|").flatMap((part) => {
    const p = part.trim();
    if (/extract|extraction|tincture|\d\s*:\s*\d/i.test(p)) return [p];
    return p.split(/,\s+(?![^()]*\))/);
  });
}

/** "Citalopram Clydesdale Pharma" is the generic name + company, not a brand. */
function isGenericName(brand, ingredient) {
  const first = stems(ingredient)[0];
  return Boolean(first) && first.length >= 4 && normalize(brand).startsWith(first);
}

/** One row per product name, substances and country (the extract repeats products per route). */
export function parseArticle57(rows) {
  const headerAt = rows.findIndex((r) => /^product name/i.test(String(r[0] ?? "").trim()));
  if (headerAt < 0) throw new Error("Article 57 extract: header row not found");
  const header = rows[headerAt].map((h) => normalize(String(h).split(/\r?\n/)[0]));
  const col = (name) => header.findIndex((h) => h.startsWith(name));
  const [name, substance, country, holder] = ["product name", "active substance", "product authorisation country", "marketing authorisation holder"].map(col);
  if ([name, substance, country, holder].some((i) => i < 0)) throw new Error("Article 57 extract: expected columns not found");

  const out = [];
  const seen = new Set();
  // some names hold a second language after a line break ("Aflu \r\nафлу …"): one line
  const cell = (r, i) => String(r[i] ?? "").replace(/\s+/g, " ").trim();
  for (const r of rows.slice(headerAt + 1)) {
    const brand = cell(r, name);
    const where = cell(r, country);
    const ingredient = joinSubstances(article57Substances(cell(r, substance)));
    if (!brand || !where || !ingredient || SKIPPED_COUNTRIES.has(where.toLowerCase())) continue;
    const key = `${brand}|${ingredient}|${where}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const ni = where === NORTHERN_IRELAND;
    const generic = isGenericName(brand, ingredient);
    out.push({
      brand,
      ingredient,
      country: ni ? "United Kingdom" : where,
      holder: cell(r, holder) || undefined,
      status: [ni ? "Authorised in Northern Ireland" : "Authorised", generic ? "generic name and company" : ""].filter(Boolean).join("; "),
    });
  }
  return out;
}

export const article57 = {
  id: "ema-article57",
  name: "EMA Article 57 database (EEA national authorisations)",
  kind: "official",
  countries: [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Estonia", "Germany", "Greece", "Hungary", "Iceland", "Latvia",
    "Liechtenstein", "Luxembourg", "Norway", "Portugal", "Romania", "Slovakia", "Slovenia", "United Kingdom",
  ],
  coverage:
    "Austria, Belgium, Bulgaria, Croatia, Cyprus, Estonia, Germany, Greece, Hungary, Iceland, Latvia, Liechtenstein, Luxembourg, Norway, Portugal, Romania, Slovakia, Slovenia and the United Kingdom (Northern Ireland): authorised medicines",
  homepage:
    "https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/data-medicines-iso-idmp-standards-post-authorisation/public-data-article-57-database",
  terms: "https://www.ema.europa.eu/en/about-us/about-website/legal-notice",
  reuse: "Name the European Medicines Agency (EMA) as the source in every copy",
  // EMA publishes a new extract about once a month
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => parseArticle57(readFirstSheet(await downloadBuffer(fetchImpl, ARTICLE57_URL))),
};
