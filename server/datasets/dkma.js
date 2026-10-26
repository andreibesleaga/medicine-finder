// Denmark: Danish Medicines Agency (Lægemiddelstyrelsen) list of authorised medicines (.xlsx,
// updated daily). Columns: Drugid, Navn, Lægemiddelform, Styrketekst, AktiveSubstanser,
// MftIndehaver, ATC-kode, Godkendt procedure, Godkendt rolle, Registreringsdato, Er i Medicinpriser.
// Substances are comma-separated; commas inside parentheses belong to the name.

import { readFirstSheet } from "../lib/xlsx.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, downloadBuffer, joinSubstances } from "./common.js";

// the agency's stable link; it redirects to /ftp-upload/ListeOverGodkendteLaegemidler.xlsx
export const DKMA_URL = "https://laegemiddelstyrelsen.dk/LinkArchive.ashx?id=0BD4960F0D7744E3BABC951431681ECC&lang=da";
// procedures left out: parallel imports (another company's copy of a listed product),
// natural medicines and vitamins; veterinary products (ATC code "Q…") are left out as well
const SKIPPED = new Set(["Par-Imp", "Natur", "Vitamin"]);
// veterinary products have an ATC code starting with Q
const isVeterinary = (atc) => String(atc ?? "").trim().toUpperCase().startsWith("Q");

/** Substances split on commas outside parentheses; digit-only fragments dropped. */
export function splitSubstances(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth = Math.max(0, depth - 1);
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p && !/^\d+$/.test(p)).map(tidyCase);
}

/** Authorised medicines from the first sheet (header row "Drugid", "Navn", ...). */
export function parseDkmaRows(rows) {
  const [header, ...body] = rows;
  if (header?.[0] !== "Drugid" || header?.[1] !== "Navn") throw new Error("Danish list: header row not found");
  const col = Object.fromEntries(header.map((name, i) => [name, i]));
  const out = [];
  for (const r of body) {
    const name = String(r[col.Navn] ?? "").trim();
    const substances = String(r[col.AktiveSubstanser] ?? "");
    if (!name || !substances || SKIPPED.has(r[col["Godkendt procedure"]])) continue;
    if (isVeterinary(r[col["ATC-kode"]])) continue;
    const ingredient = joinSubstances(splitSubstances(substances));
    if (!ingredient) continue;
    out.push({
      brand: name,
      ingredient,
      country: "Denmark",
      holder: r[col.MftIndehaver] || undefined,
      strength: r[col.Styrketekst] || undefined,
      form: r[col["Lægemiddelform"]] || undefined,
      status: r[col["Er i Medicinpriser"]] === "Ja" ? "Authorised, in the price list" : "Authorised",
    });
  }
  return out;
}

export const dkma = {
  id: "dkma",
  name: "Denmark, Danish Medicines Agency authorised medicines",
  kind: "official",
  countries: ["Denmark"],
  coverage: "Denmark, authorised human medicines (no veterinary products or parallel imports)",
  homepage: "https://laegemiddelstyrelsen.dk/en/licensing/licensing-of-medicines/lists-of-authorised-and-deregistered-medicines/",
  terms: "https://laegemiddelstyrelsen.dk/en/about/copyright-and-logo/",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseDkmaRows(readFirstSheet(await downloadBuffer(fetchImpl, DKMA_URL))),
};
