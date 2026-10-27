// What to show for a chosen country or region, with fallbacks when there is no data for it:
// the country itself, then its region (EU-wide authorisations for EU/EEA members), then
// worldwide references, and finally all countries, with a note saying so.

import type { MedicineResult } from "@/types/medicine";
import { countries, getRegionForCountry } from "@/constants/countries";

export const EU_MEMBERS = new Set(
  [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France",
    "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
    "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
  ].map((s) => s.toLowerCase()),
);
/** EU central authorisations also apply in the EEA countries. */
const EEA = new Set([...EU_MEMBERS, "iceland", "liechtenstein", "norway"]);

const EU_WIDE = "european union";
const NOT_STATED = "not stated";

export interface Scoped {
  results: MedicineResult[];
  /** set when the results come from a wider area than the one chosen (English) */
  note?: string;
  /** the same note as a dictionary key and its values, for the page's language */
  noteKey?: string;
  noteVars?: Record<string, string>;
}

export const isRegion = (selection: string) => selection.startsWith("region:");
export const selectionLabel = (selection: string) =>
  countries.find((c) => c.value === selection)?.label.replace(/^\P{L}+/u, "") ?? selection;

/** The name passed to the server (and the AI prompt): a country, or a region such as "Asia". */
export const selectionForServer = (selection?: string) =>
  !selection || selection === "all" ? undefined : isRegion(selection) ? selection.slice("region:".length).replace(/^EU$/, "European Union") : selection;

function regionOf(country: string): string {
  const c = country.toLowerCase();
  if (c === EU_WIDE) return "Europe";
  return getRegionForCountry(country);
}

export function scopeResults(all: MedicineResult[], selection?: string): Scoped {
  if (!selection || selection === "all") return { results: all };
  const general = all.filter((r) => r.country.toLowerCase() === NOT_STATED);

  if (isRegion(selection)) {
    const region = selection.slice("region:".length);
    const inRegion =
      region === "EU"
        ? all.filter((r) => EU_MEMBERS.has(r.country.toLowerCase()) || r.country.toLowerCase() === EU_WIDE)
        : all.filter((r) => r.country.toLowerCase() !== NOT_STATED && regionOf(r.country) === region);
    if (inRegion.length) return { results: [...inRegion, ...general] };
    return { results: all, note: `No data for ${selectionLabel(selection)} yet; showing results from all countries.`, noteKey: "note.noData", noteVars: { place: selection } };
  }

  const c = selection.toLowerCase();
  const national = all.filter((r) => r.country.toLowerCase() === c);
  const euWide = EEA.has(c) ? all.filter((r) => r.country.toLowerCase() === EU_WIDE) : [];
  if (national.length) return { results: [...national, ...euWide, ...general] };
  if (euWide.length) {
    return {
      results: [...euWide, ...general],
      note: `No national data for ${selection} yet; showing EU-wide authorisations (valid in ${selection}) and worldwide references.`,
      noteKey: "note.euWide",
      noteVars: { place: selection },
    };
  }
  const region = getRegionForCountry(selection);
  const sameRegion = all.filter((r) => r.country.toLowerCase() !== NOT_STATED && regionOf(r.country) === region);
  if (sameRegion.length) {
    return {
      results: [...sameRegion, ...general],
      note: `No data for ${selection} yet; showing other countries in ${region} and worldwide references. Brands differ by country.`,
      noteKey: "note.region",
      noteVars: { place: selection, region },
    };
  }
  return {
    results: all,
    note: `No data for ${selection} or ${region} yet; showing results from all countries. Brands differ by country.`,
    noteKey: "note.nothing",
    noteVars: { place: selection, region },
  };
}
