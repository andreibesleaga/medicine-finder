// Switzerland: Swissmedic list of authorised packs for human medicines (.xlsx).

import { readFirstSheet } from "../lib/xlsx.js";
import { splitProductName } from "../lib/text.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

export const SWISSMEDIC_URL =
  "https://www.swissmedic.ch/dam/swissmedic/de/dokumente/internetlisten/zugelassene_packungen_human.xlsx.download.xlsx/zugelassene_packungen_ham.xlsx";

/** Columns: 0 authorisation number, 2 name ("Brand, form"), 3 holder, 16 active substances (Latin). */
export function parseSwissmedicRows(rows) {
  const headerAt = rows.findIndex((r) => String(r[0] ?? "").startsWith("Zulassungs"));
  if (headerAt < 0) throw new Error("Swissmedic list: header row not found");
  const seen = new Set();
  const out = [];
  for (const r of rows.slice(headerAt + 1)) {
    const [number, , name, holder] = r;
    const substances = String(r[16] ?? "");
    if (!number || !name || !substances) continue;
    const key = `${number}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { brand, strength, form } = splitProductName(name);
    out.push({
      brand,
      ingredient: joinSubstances(substances.split(",")),
      country: "Switzerland",
      holder: holder || undefined,
      strength,
      form,
      status: "Authorised",
    });
  }
  return out;
}

export const swissmedic = {
  id: "swissmedic",
  name: "Switzerland, Swissmedic authorised medicines",
  kind: "official",
  countries: ["Switzerland"],
  coverage: "Switzerland, authorised human medicine packs",
  homepage: "https://www.swissmedic.ch/swissmedic/en/home/services/listen_neu.html",
  terms: "https://www.swissmedic.ch/swissmedic/en/home/services/legal-notices.html",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseSwissmedicRows(readFirstSheet(await downloadBuffer(fetchImpl, SWISSMEDIC_URL))),
};
