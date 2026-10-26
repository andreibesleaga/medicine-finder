import { describe, it, expect } from "vitest";
import { addAiSuggestions, mergeResults, searchMedicines } from "@/lib/search/searchMedicines";
import { scopeResults, selectionForServer } from "@/lib/search/countryScope";
import { cacheKey, readCached, saveCached } from "@/lib/search/resultCache";
import type { MedicineResult } from "@/types/medicine";
import { jsonResponse, stubFetch } from "./helpers";

type Row = Omit<MedicineResult, "id">;
const row = (brandName: string, country: string, kind: Row["kind"], sourceId: string = kind, activeIngredient = "ibuprofen"): Row => ({
  brandName,
  activeIngredient,
  country,
  kind,
  sourceId,
  sourceName: sourceId,
});

describe("merging and ranking", () => {
  it("keeps one card per brand and country from the most reliable source", () => {
    const merged = mergeResults([
      row("Advil", "United States", "ai", "AI suggestion: OpenRouter"),
      row("ADVIL", "United States", "reference", "openfda"),
      row("Advil", "United States", "reference", "rxnorm"),
      row("Advil", "Not stated", "reference", "wikidata"),
      row("Brufen", "Not stated", "reference", "pubchem"),
      row("Nurofen", "France", "official", "bdpm"),
      row("Nurofen", "Italy", "curated", "curated"),
    ]);
    expect(merged.map((r) => [r.brandName, r.country, r.sourceId, r.alsoIn])).toEqual([
      ["Nurofen", "France", "bdpm", undefined],
      ["Advil", "United States", "rxnorm", ["openfda", "AI suggestion: OpenRouter", "wikidata"]],
      ["Brufen", "Not stated", "pubchem", undefined],
      ["Nurofen", "Italy", "curated", undefined],
    ]);
    expect(new Set(merged.map((r) => r.id)).size).toBe(merged.length);
  });

  it("puts single-ingredient products before combinations, then agreement, then name", () => {
    const merged = mergeResults([
      row("Actisinu", "Italy", "official", "aifa", "Ibuprofene + Pseudoefedrina"),
      row("Moment", "Italy", "official", "aifa"),
      row("Brufen", "Italy", "official", "aifa"),
      row("Brufen", "Italy", "curated", "curated"),
    ]);
    expect(merged.map((r) => r.brandName)).toEqual(["Brufen", "Moment", "Actisinu"]);
  });
});

describe("country and region scope", () => {
  const all = mergeResults([
    row("Brufen", "Italy", "official", "aifa"),
    row("Pedea", "European Union", "official", "ema"),
    row("Advil", "United States", "reference", "rxnorm"),
    row("Ibu", "Not stated", "reference", "wikidata"),
    row("Nurofen", "Canada", "official", "health-canada"),
  ]);
  const names = (s: { results: MedicineResult[] }) => s.results.map((r) => r.brandName);

  it("shows the country, then EU-wide authorisations, then worldwide references", () => {
    const s = scopeResults(all, "Italy");
    expect(names(s)).toEqual(["Brufen", "Pedea", "Ibu"]);
    expect(s.note).toBeUndefined();
  });

  it("falls back to EU-wide data for an EU or EEA country without national data", () => {
    const s = scopeResults(all, "Norway");
    expect(names(s)).toEqual(["Pedea", "Ibu"]);
    expect(s.note).toContain("No national data for Norway");
  });

  it("falls back to the same region, then to all countries", () => {
    const americas = scopeResults(all, "Mexico");
    expect(names(americas)).toEqual(["Nurofen", "Advil", "Ibu"]);
    expect(americas.note).toContain("other countries in North America");
    const asia = scopeResults(all, "Japan");
    expect(names(asia)).toHaveLength(5);
    expect(asia.note).toContain("showing results from all countries");
  });

  it("filters by region, EU membership included", () => {
    expect(names(scopeResults(all, "region:EU"))).toEqual(["Brufen", "Pedea", "Ibu"]);
    expect(names(scopeResults(all, "region:Europe"))).toEqual(["Brufen", "Pedea", "Ibu"]);
    expect(names(scopeResults(all, "region:North America"))).toEqual(["Nurofen", "Advil", "Ibu"]);
    expect(scopeResults(all, "region:Africa").note).toContain("No data for Africa");
    expect(scopeResults(all, undefined).results).toHaveLength(5);
  });

  it("sends a readable name to the server", () => {
    expect(selectionForServer("region:EU")).toBe("European Union");
    expect(selectionForServer("region:Asia")).toBe("Asia");
    expect(selectionForServer("Italy")).toBe("Italy");
    expect(selectionForServer("all")).toBeUndefined();
  });
});

describe("searchMedicines", () => {
  const officialServer = () =>
    jsonResponse({
      results: [{ brandName: "Pedea", activeIngredient: "Ibuprofen", country: "European Union", sourceId: "ema", sourceName: "EMA", kind: "official" }],
      sources: [{ id: "ema", name: "EMA", kind: "official", state: "ok", count: 1 }],
    });

  it("combines browser sources and the server, reports progress, then adds AI suggestions", async () => {
    const fetch = stubFetch([
      ["rxcui.json", () => jsonResponse({ idGroup: { rxnormId: ["5640"] } })],
      ["related.json", () => jsonResponse({ relatedGroup: { conceptGroup: [{ conceptProperties: [{ rxcui: "1", name: "Advil" }] }] } })],
      ["api.fda.gov", () => jsonResponse({ error: {} }, 404)],
      ["query.wikidata.org", () => jsonResponse("busy", 503, "text/plain")],
      ["pubchem", () => jsonResponse({}, 404)],
      ["clinicaltrials.gov", () => jsonResponse({ totalCount: 5 })],
      ["/api/search?q=ibuprofen", officialServer],
      [
        "/api/ai?q=ibuprofen",
        () =>
          jsonResponse({
            results: [
              { brandName: "Advil", activeIngredient: "ibuprofen", country: "United States", sourceId: "ai-openrouter", sourceName: "AI suggestion: OpenRouter", kind: "ai" },
              { brandName: "Madeupin", activeIngredient: "ibuprofen", country: "Peru", sourceId: "ai-openrouter", sourceName: "AI suggestion: OpenRouter", kind: "ai" },
            ],
            sources: [{ id: "ai-openrouter", name: "AI suggestion: OpenRouter", kind: "ai", state: "ok", count: 2 }],
          }),
      ],
    ]);
    const progress: number[] = [];
    const first = await searchMedicines("ibuprofen", undefined, (s) => progress.push(s.length), fetch);
    expect(first.results[0]).toMatchObject({ brandName: "Pedea", kind: "official" });
    expect(first.aiPending).toBe(true);
    expect(first.trials).toEqual({ count: 5, url: "https://clinicaltrials.gov/search?intr=ibuprofen" });
    expect(Object.fromEntries(first.sources.map((s) => [s.id, s.state]))).toMatchObject({ ema: "ok", rxnorm: "ok", openfda: "ok", wikidata: "error" });
    expect(progress.length).toBeGreaterThan(3);

    const withAi = await addAiSuggestions(first, fetch);
    expect(withAi.aiPending).toBe(false);
    // the AI name that matches RxNorm confirms it; the unknown one stays a separate, flagged card
    expect(withAi.results.find((r) => r.brandName === "Advil")).toMatchObject({ sourceId: "rxnorm", alsoIn: ["AI suggestion: OpenRouter"] });
    expect(withAi.results.at(-1)).toMatchObject({ brandName: "Madeupin", kind: "ai" });
  });

  it("asks the browser sources, trials and AI for the ingredient when the term is a brand name", async () => {
    const brand = { name: "Nurofen", ingredient: "Ibuprofen", searchFor: "ibuprofen", others: [] };
    const fetch = stubFetch([
      ["rxcui.json?name=ibuprofen", () => jsonResponse({ idGroup: { rxnormId: ["5640"] } })],
      ["rxcui.json?name=nurofen", () => jsonResponse({ idGroup: {} })],
      ["related.json", () => jsonResponse({ relatedGroup: { conceptGroup: [{ conceptProperties: [{ rxcui: "1", name: "Advil" }] }] } })],
      [/api\.fda\.gov|wikidata|pubchem/, () => jsonResponse({}, 404)],
      ["clinicaltrials.gov", (url) => jsonResponse({ totalCount: url.includes("intr=ibuprofen") ? 7 : 0 })],
      ["/api/search?q=nurofen", () => jsonResponse({ brand, results: [], sources: [] })],
      ["/api/ai?q=ibuprofen", () => jsonResponse({ results: [], sources: [] })],
    ]);
    const out = await searchMedicines("nurofen", undefined, () => {}, fetch);
    expect(out.brand).toEqual(brand);
    expect(out.results.map((r) => r.brandName)).toEqual(["Advil"]);
    expect(out.trials?.count).toBe(7);
    const withAi = await addAiSuggestions(out, fetch);
    expect(withAi.brand).toEqual(brand);
    expect(fetch.calls.some((u) => u.includes("/api/ai?q=ibuprofen"))).toBe(true);
  });

  it("still answers when the search server is missing (static hosting) and skips the AI phase", async () => {
    const fetch = stubFetch([
      ["/api/search", () => jsonResponse("<!doctype html>", 200, "text/html")],
      [/rxnav|fda|wikidata|pubchem|clinicaltrials/, () => jsonResponse({}, 404)],
    ]);
    const out = await searchMedicines("ibuprofen", undefined, () => {}, fetch);
    expect(out.sources.find((s) => s.id === "server")).toMatchObject({ state: "unavailable", detail: "the search server is not available here" });
    expect(out.aiPending).toBe(false);
  });

  it("marks AI unavailable when its endpoint fails", async () => {
    const fetch = stubFetch([[/./, () => jsonResponse({ error: "Too many searches; try again shortly" }, 429)]]);
    const out = await addAiSuggestions({ term: "x", results: [], sources: [] }, fetch);
    expect(out.sources).toEqual([{ id: "ai", name: "AI suggestions", kind: "ai", state: "unavailable", count: 0, detail: "Too many searches; try again shortly" }]);
  });
});

describe("browser cache", () => {
  it("does nothing, without errors, where IndexedDB is not available", async () => {
    expect(cacheKey(" Ibuprofen ", "Italy")).toBe("ibuprofen|Italy");
    await expect(saveCached("k", { term: "x", results: [], sources: [] })).resolves.toBeUndefined();
    await expect(readCached("k")).resolves.toBeNull();
  });
});
