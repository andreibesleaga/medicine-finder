import { describe, it, expect } from "vitest";
import { filterByCountry, mergeResults, searchMedicines } from "@/lib/search/searchMedicines";
import { searchCurated } from "@/lib/search/curated";
import type { MedicineResult } from "@/types/medicine";
import { jsonResponse, stubFetch } from "./helpers";

type Row = Omit<MedicineResult, "id">;
const row = (brandName: string, country: string, kind: Row["kind"], sourceName = kind): Row => ({
  brandName,
  activeIngredient: "ibuprofen",
  country,
  kind,
  sourceId: sourceName,
  sourceName,
});

describe("curated lists", () => {
  it("are labelled as curated and understand synonyms", () => {
    const rows = searchCurated("Acetaminophen");
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((r) => r.kind === "curated" && r.sourceName.startsWith("Curated sample"))).toBe(true);
    expect(rows.find((r) => r.brandName === "Combiflam")?.activeIngredient).toBe("ibuprofen + paracetamol");
    expect(searchCurated("xyzfoo")).toEqual([]);
  });

  it("no longer invents products for unknown ingredients", () => {
    expect(searchCurated("totally-made-up")).toEqual([]);
  });
});

describe("merging", () => {
  it("keeps one card per brand and country from the most reliable source", () => {
    const merged = mergeResults([
      row("Advil", "United States", "ai", "AI"),
      row("ADVIL", "United States", "reference", "RxNorm"),
      row("Advil", "Not stated", "reference", "Wikidata"),
      row("Brufen", "Not stated", "reference", "PubChem"),
      row("Nurofen", "France", "official", "BDPM"),
      row("Nurofen", "Italy", "curated", "Curated"),
    ]);
    expect(merged.map((r) => [r.brandName, r.country, r.sourceName, r.alsoIn])).toEqual([
      ["Nurofen", "France", "BDPM", undefined],
      ["ADVIL", "United States", "RxNorm", ["AI", "Wikidata"]],
      ["Brufen", "Not stated", "PubChem", undefined],
      ["Nurofen", "Italy", "Curated", undefined],
    ]);
    expect(new Set(merged.map((r) => r.id)).size).toBe(merged.length);
  });

  it("filters by country and keeps EU-wide results for member states", () => {
    const rows = mergeResults([row("A", "European Union", "official"), row("B", "Italy", "curated"), row("C", "Canada", "official"), row("D", "Not stated", "reference")]);
    expect(filterByCountry(rows, "Italy").map((r) => r.brandName)).toEqual(["A", "D", "B"]);
    expect(filterByCountry(rows, "Canada").map((r) => r.brandName)).toEqual(["C", "D"]);
    expect(filterByCountry(rows, undefined)).toHaveLength(4);
  });
});

describe("searchMedicines", () => {
  it("combines browser sources, the server and curated lists, and reports progress", async () => {
    const fetch = stubFetch([
      ["rxcui.json", () => jsonResponse({ idGroup: { rxnormId: ["5640"] } })],
      ["related.json", () => jsonResponse({ relatedGroup: { conceptGroup: [{ conceptProperties: [{ rxcui: "1", name: "Advil" }] }] } })],
      ["api.fda.gov", () => jsonResponse({ error: {} }, 404)],
      ["query.wikidata.org", () => jsonResponse("busy", 503, "text/plain")],
      ["pubchem", () => jsonResponse({}, 404)],
      ["clinicaltrials.gov", () => jsonResponse({ totalCount: 5 })],
      [
        "/api/search?q=ibuprofen",
        () =>
          jsonResponse({
            results: [{ brandName: "Pedea", activeIngredient: "Ibuprofen", country: "European Union", sourceId: "ema", sourceName: "EMA", kind: "official" }],
            sources: [{ id: "ema", name: "EMA", kind: "official", state: "ok", count: 1 }],
          }),
      ],
    ]);
    const progress: number[] = [];
    const out = await searchMedicines("ibuprofen", undefined, (s) => progress.push(s.length), fetch);
    expect(out.results[0]).toMatchObject({ brandName: "Pedea", kind: "official" });
    expect(out.results.some((r) => r.brandName === "Advil" && r.sourceId === "rxnorm")).toBe(true);
    expect(out.results.some((r) => r.kind === "curated")).toBe(true);
    expect(out.trials).toEqual({ count: 5, url: "https://clinicaltrials.gov/search?intr=ibuprofen" });
    const states = Object.fromEntries(out.sources.map((s) => [s.id, s.state]));
    expect(states).toMatchObject({ ema: "ok", rxnorm: "ok", openfda: "ok", wikidata: "error", curated: "ok" });
    expect(states.server).toBeUndefined();
    expect(progress.length).toBeGreaterThan(3);
  });

  it("still answers when the search server is missing (static hosting)", async () => {
    const fetch = stubFetch([
      ["/api/search", () => jsonResponse("<!doctype html>", 200, "text/html")],
      [/rxnav|fda|wikidata|pubchem|clinicaltrials/, () => jsonResponse({}, 404)],
    ]);
    const out = await searchMedicines("ibuprofen", undefined, () => {}, fetch);
    expect(out.sources.find((s) => s.id === "server")).toMatchObject({ state: "unavailable", detail: "the search server is not available here" });
    expect(out.results.length).toBeGreaterThan(0);
  });
});
