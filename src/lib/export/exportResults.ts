// Files a user downloads at the end of the results: CSV (RFC 4180, UTF-8 with BOM so Excel reads
// it) and JSON. Built in the browser from what the page shows, so the file matches the page. Every
// row names its source, that source's terms and any condition of reuse (EMA, for one, must be named
// in every copy); AI rows are marked as model output.

import type { SearchOutcome, SourceKind } from "@/types/medicine";
import type { ServerSourceInfo } from "@/lib/search/serverApi";
import { BROWSER_SOURCES } from "@/lib/search/browserSources";
import { countryCode } from "./countryCodes";
import { toXlsx } from "./xlsx";

export interface SourceTerms {
  homepage?: string;
  terms?: string;
  reuse?: string;
}

export interface ExportRow {
  brand: string;
  activeIngredient: string;
  country: string;
  /** ISO 3166-1 alpha-2 ("EU" for EU-wide authorisations); empty when the source states no country */
  countryCode: string;
  holder: string;
  strength: string;
  dosageForm: string;
  status: string;
  source: string;
  sourceType: SourceKind;
  sourceTerms: string;
  reuseCondition: string;
  recordUrl: string;
  alsoListedBy: string;
}

const AI_NOTE = "AI suggestion: model output, not data from a register; check before use";
const NLM_SOURCES = new Set(["rxnorm"]);
export const NLM_ATTRIBUTION =
  "This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.";
export const NOT_MEDICAL_ADVICE = "Not medical advice. Check the active ingredient and strength on the pack and ask a pharmacist.";

/**
 * Terms of every source in an outcome: the server's runs carry them; the browser sources have their
 * own; `server` (the /api/sources list) fills in runs saved before 2.4.0, which had none.
 */
export function sourceTerms(outcome: SearchOutcome, server: ServerSourceInfo[] = []): Map<string, SourceTerms> {
  const map = new Map<string, SourceTerms>();
  for (const s of server) map.set(s.id, { homepage: s.homepage, terms: s.terms, reuse: s.reuse });
  for (const r of outcome.sources) if (r.terms || r.homepage) map.set(r.id, { homepage: r.homepage, terms: r.terms, reuse: r.reuse });
  for (const s of BROWSER_SOURCES) map.set(s.id, { homepage: s.homepage, terms: s.terms });
  return map;
}

/** True when a row's source (official, curated) has no terms in `terms`: the list must be fetched. */
export function missingTerms(outcome: SearchOutcome, terms: Map<string, SourceTerms>): boolean {
  return outcome.results.some((r) => {
    const t = terms.get(r.sourceId);
    return r.kind !== "ai" && !(t?.terms || t?.homepage);
  });
}

// where to read a source's terms when they could not be loaded
export const TERMS_FALLBACK = "terms not loaded: see the Data sources page of the app";

/** Source ids by source name, for the names in `alsoIn`. */
function idsByName(outcome: SearchOutcome): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of BROWSER_SOURCES) map.set(s.name, s.id);
  for (const r of outcome.sources) map.set(r.name, r.id);
  for (const r of outcome.results) map.set(r.sourceName, r.sourceId);
  return map;
}

const unique = (list: string[]) => [...new Set(list.filter(Boolean))];

export function exportRows(outcome: SearchOutcome, terms: Map<string, SourceTerms>): ExportRow[] {
  const ids = idsByName(outcome);
  return outcome.results.map((r) => {
    // the row's own source first, then the other sources that list the same brand
    const all = [r.sourceId, ...(r.alsoIn ?? []).map((n) => ids.get(n) ?? "")];
    const known = all.map((id) => ({ id, t: terms.get(id) }));
    const ai = r.kind === "ai" || (r.alsoIn ?? []).some((n) => n.startsWith("AI suggestion"));
    const conditions = unique([
      r.kind === "ai" ? AI_NOTE : "",
      ...known.map(({ t }) => t?.reuse ?? ""),
      all.some((id) => NLM_SOURCES.has(id)) ? NLM_ATTRIBUTION : "",
    ]);
    return {
      brand: r.brandName,
      activeIngredient: r.activeIngredient,
      country: r.country,
      countryCode: countryCode(r.country) ?? "",
      holder: r.manufacturer ?? "",
      strength: r.strength ?? "",
      dosageForm: r.dosageForm ?? "",
      status: r.status ?? "",
      source: r.sourceName,
      sourceType: r.kind,
      sourceTerms: unique(known.map(({ id, t }) => t?.terms ?? t?.homepage ?? (id && !ai ? TERMS_FALLBACK : ""))).join(" ; "),
      reuseCondition: conditions.join(" ; "),
      recordUrl: r.url ?? "",
      alsoListedBy: (r.alsoIn ?? []).join("; "),
    };
  });
}

const CSV_COLUMNS: [keyof ExportRow, string][] = [
  ["brand", "brand"],
  ["activeIngredient", "active_ingredient"],
  ["country", "country"],
  ["countryCode", "country_code"],
  ["holder", "holder"],
  ["strength", "strength"],
  ["dosageForm", "dosage_form"],
  ["status", "status"],
  ["source", "source"],
  ["sourceType", "source_type"],
  ["sourceTerms", "source_terms"],
  ["reuseCondition", "reuse_condition"],
  ["recordUrl", "record_url"],
  ["alsoListedBy", "also_listed_by"],
];

/**
 * One CSV field: quoted when it holds a comma, quote or line break (RFC 4180). A field starting
 * with = + - @ (or a tab or CR) gets a leading apostrophe, so a spreadsheet shows it as text
 * instead of running it as a formula.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_COLUMNS.map(([, h]) => h), ...rows.map((r) => CSV_COLUMNS.map(([k]) => r[k]))];
  return `\uFEFF${lines.map((cells) => cells.map(csvField).join(",")).join("\r\n")}\r\n`;
}

export interface ExportContext {
  /** the page address of this search */
  link: string;
  /** RFC 3339 time the file was made */
  generatedAt: string;
}

export function toJson(outcome: SearchOutcome, rows: ExportRow[], terms: Map<string, SourceTerms>, ctx: ExportContext): string {
  const ids = idsByName(outcome);
  // every source a row comes from or is also listed by, in order of first use
  const used = new Map<string, { name: string; kind: SourceKind }>();
  for (const r of outcome.results) {
    if (!used.has(r.sourceId)) used.set(r.sourceId, { name: r.sourceName, kind: r.kind });
    for (const n of r.alsoIn ?? []) {
      const id = ids.get(n) ?? n;
      if (!used.has(id)) used.set(id, { name: n, kind: outcome.sources.find((s) => s.id === id)?.kind ?? (n.startsWith("AI suggestion") ? "ai" : "reference") });
    }
  }
  const body = {
    format: "medicine-brand-finder/results",
    version: 1,
    generatedAt: ctx.generatedAt,
    link: ctx.link,
    query: {
      term: outcome.term,
      country: outcome.country ?? null,
      ...(outcome.brand ? { brand: { name: outcome.brand.name, ingredient: outcome.brand.ingredient, alsoUsedFor: outcome.brand.others } } : {}),
    },
    notice: NOT_MEDICAL_ADVICE,
    attribution: [...used.keys()].some((id) => NLM_SOURCES.has(id)) ? [NLM_ATTRIBUTION] : [],
    sources: [...used.entries()].map(([id, u]) => {
      const t = terms.get(id) ?? {};
      return {
        name: u.name,
        type: u.kind,
        homepage: t.homepage ?? null,
        terms: t.terms ?? null,
        reuseCondition: u.kind === "ai" ? AI_NOTE : (t.reuse ?? null),
      };
    }),
    results: rows,
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^region:/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** The XLSX workbook: the rows (CSV columns, header bold and frozen) and a "Sources" sheet. */
export function toXlsxFile(outcome: SearchOutcome, rows: ExportRow[], terms: Map<string, SourceTerms>, ctx: ExportContext): Uint8Array {
  const json = JSON.parse(toJson(outcome, rows, terms, ctx)) as { sources: { name: string; type: string; homepage: string | null; terms: string | null; reuseCondition: string | null }[]; attribution: string[] };
  const results = [CSV_COLUMNS.map(([, h]) => h), ...rows.map((r) => CSV_COLUMNS.map(([k]) => r[k]))];
  const sources = [
    ["source", "source_type", "homepage", "terms", "reuse_condition"],
    ...json.sources.map((s) => [s.name, s.type, s.homepage ?? "", s.terms ?? "", s.reuseCondition ?? ""]),
    [],
    ["search", outcome.term],
    ["made", ctx.generatedAt],
    ["link", ctx.link],
    ...json.attribution.map((a) => ["attribution", a]),
    ["notice", NOT_MEDICAL_ADVICE],
  ];
  return toXlsx([
    { name: "Results", rows: results, widths: [28, 28, 16, 8, 28, 14, 18, 18, 28, 10, 40, 40, 40, 28] },
    { name: "Sources", rows: sources, widths: [36, 12, 40, 40, 50] },
  ]);
}

export type ExportKind = "csv" | "json" | "xlsx" | "fhir";
const EXTENSION: Record<ExportKind, string> = { csv: "csv", json: "json", xlsx: "xlsx", fhir: "fhir-r4.json" };

/** "medicine-finder_ibuprofen_germany_2026-10-26.csv" */
export function exportFileName(outcome: SearchOutcome, generatedAt: string, kind: ExportKind): string {
  const parts = ["medicine-finder", slug(outcome.term), outcome.country ? slug(outcome.country) : "all-countries", generatedAt.slice(0, 10)];
  return `${parts.filter(Boolean).join("_")}.${EXTENSION[kind]}`;
}
