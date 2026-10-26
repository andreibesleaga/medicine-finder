// Sweden: Läkemedelsverket list of all medicinal products (.xlsx, regenerated daily; CC BY 4.0 per
// the Swedish data portal record).

import { readFirstSheet } from "../lib/xlsx.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

export const MPA_URL = "https://www.lakemedelsverket.se/globalassets/excel/Lakemedelsprodukter.xlsx";
const CURRENT = new Set(["Godkänd", "Registrerad"]);

/** Human medicines that are approved or registered, not parallel imports or homeopathic. */
export function parseMpaRows(rows) {
  const [header, ...body] = rows;
  if (header?.[0] !== "Namn") throw new Error("Swedish list: header row not found");
  const col = Object.fromEntries(header.map((name, i) => [name, i]));
  const at = (r, name) => String(r[col[name]] ?? "").trim();
  const out = [];
  for (const r of body) {
    const name = at(r, "Namn");
    const substances = at(r, "Verksamt ämne (förenklat)") || at(r, "Verksamt ämne");
    if (!name || !substances || at(r, "H/V") !== "HUM" || !CURRENT.has(at(r, "Registrerings-status"))) continue;
    if (at(r, "Parallellimport") || at(r, "Produktkategori") === "Homeopatiskt läkemedel") continue;
    out.push({
      brand: name,
      ingredient: joinSubstances(substances.split(/\s+\+\s+|\n/)),
      country: "Sweden",
      holder: at(r, "Innehavare") || undefined,
      strength: at(r, "Styrka") || undefined,
      form: at(r, "Form") || undefined,
      status: at(r, "Försäljningsstatus") === "Finns till försäljning" ? "Approved, on sale" : "Approved",
    });
  }
  return out;
}

export const mpa = {
  id: "mpa",
  name: "Sweden, Läkemedelsverket medicinal products",
  kind: "official",
  countries: ["Sweden"],
  coverage: "Sweden, approved and registered human medicines (not parallel imports)",
  homepage: "https://www.lakemedelsverket.se/sv/sok-lakemedelsfakta",
  terms: "https://creativecommons.org/licenses/by/4.0/",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseMpaRows(readFirstSheet(await downloadBuffer(fetchImpl, MPA_URL))),
};
