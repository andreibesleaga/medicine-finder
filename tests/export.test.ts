import { describe, it, expect } from "vitest";
import { csvField, exportFileName, exportRows, missingTerms, NLM_ATTRIBUTION, sourceTerms, TERMS_FALLBACK, toCsv, toJson } from "@/lib/export/exportResults";
import { countries } from "@/constants/countries";
import { countryCode } from "@/lib/export/countryCodes";
import type { MedicineResult, SearchOutcome } from "@/types/medicine";
import type { ServerSourceInfo } from "@/lib/search/serverApi";

const server: ServerSourceInfo[] = [
  { id: "ema-article57", name: "EMA Article 57", kind: "official", coverage: "", homepage: "https://ema.example/a57", terms: "https://ema.example/legal", reuse: "Name EMA as the source in every copy", enabled: true, state: "ready" },
  { id: "malta-ma", name: "Malta", kind: "official", coverage: "", homepage: "https://mt.example", terms: "https://mt.example/copyright", reuse: "Not for commercial use", enabled: true, state: "ready" },
];
const result = (over: Partial<MedicineResult>): MedicineResult => ({
  id: "x",
  brandName: "Dolormin",
  activeIngredient: "Ibuprofen",
  country: "Germany",
  sourceId: "ema-article57",
  sourceName: "EMA Article 57",
  kind: "official",
  ...over,
});
const outcome: SearchOutcome = {
  term: "nurofen",
  country: "region:Europe",
  brand: { name: "Nurofen", ingredient: "Ibuprofen", searchFor: "ibuprofen", others: [] },
  results: [
    result({ manufacturer: "J&J, GmbH", alsoIn: ["Malta"] }),
    result({ brandName: "Advil", country: "United States", sourceId: "rxnorm", sourceName: "RxNorm (US NLM)", kind: "reference", url: "https://rxnav.example/1" }),
    result({ brandName: "=HYPERLINK(\"x\")", country: "Not stated", sourceId: "ai-openrouter", sourceName: "AI suggestion: OpenRouter", kind: "ai" }),
  ],
  sources: [
    { id: "ema-article57", name: "EMA Article 57", kind: "official", state: "ok", count: 1, homepage: "https://ema.example/a57", terms: "https://ema.example/legal", reuse: "Name EMA as the source in every copy" },
    { id: "malta-ma", name: "Malta", kind: "official", state: "ok", count: 0, homepage: "https://mt.example", terms: "https://mt.example/copyright", reuse: "Not for commercial use" },
  ],
};
const ctx = { link: "https://app.example/?q=nurofen", generatedAt: "2026-10-26T10:00:00.000Z" };

describe("exports", () => {
  it("gives ISO 3166 codes, including the EU and the sources' own spellings", () => {
    expect(countryCode("Germany")).toBe("DE");
    expect(countryCode("European Union")).toBe("EU");
    expect(countryCode("Czech Republic")).toBe("CZ");
    expect(countryCode("United Kingdom")).toBe("GB");
    expect(countryCode("Not stated")).toBeUndefined();
    // every country of the app's own list has a code
    const missing = countries.filter((c) => !c.isRegion && c.value !== "all" && !countryCode(c.value)).map((c) => c.value);
    expect(missing).toEqual([]);
  });

  it("quotes CSV fields as RFC 4180 asks and defuses spreadsheet formulas", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("J&J, GmbH")).toBe('"J&J, GmbH"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField("-5")).toBe("'-5");
  });

  it("writes one CSV row per result with its source, terms and reuse condition", () => {
    const terms = sourceTerms(outcome);
    expect(missingTerms(outcome, terms)).toBe(false);
    const csv = toCsv(exportRows(outcome, terms));
    expect(csv.startsWith("\uFEFFbrand,active_ingredient,country,country_code,holder,strength,dosage_form,status,source,source_type,source_terms,reuse_condition,record_url,also_listed_by\r\n")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines).toHaveLength(4);
    // a row also listed by Malta carries Malta's terms and condition too
    expect(lines[1]).toBe(
      'Dolormin,Ibuprofen,Germany,DE,"J&J, GmbH",,,,EMA Article 57,official,https://ema.example/legal ; https://mt.example/copyright,Name EMA as the source in every copy ; Not for commercial use,,Malta',
    );
    // browser sources carry their own terms; RxNorm rows carry NLM's attribution in the CSV too
    expect(lines[2]).toContain("RxNorm (US NLM),reference,https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html");
    expect(lines[2]).toContain("This product uses publicly available data from the U.S. National Library of Medicine");
    expect(lines[3]).toContain(`"'=HYPERLINK(""x"")",Ibuprofen,Not stated,,`);
    expect(lines[3]).toContain("AI suggestion: model output, not data from a register");
  });

  it("writes JSON with the query, the brand match, each source's terms and the NLM attribution", () => {
    const terms = sourceTerms(outcome);
    const body = JSON.parse(toJson(outcome, exportRows(outcome, terms), terms, ctx));
    expect(body).toMatchObject({
      format: "medicine-brand-finder/results",
      version: 1,
      generatedAt: ctx.generatedAt,
      link: ctx.link,
      query: { term: "nurofen", country: "region:Europe", brand: { name: "Nurofen", ingredient: "Ibuprofen", alsoUsedFor: [] } },
      attribution: [NLM_ATTRIBUTION],
    });
    expect(body.sources.map((s: { name: string; terms: string | null }) => [s.name, s.terms])).toEqual([
      ["EMA Article 57", "https://ema.example/legal"],
      ["Malta", "https://mt.example/copyright"],
      ["RxNorm (US NLM)", "https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html"],
      ["AI suggestion: OpenRouter", null],
    ]);
    expect(body.results[0]).toMatchObject({ brand: "Dolormin", countryCode: "DE", reuseCondition: "Name EMA as the source in every copy ; Not for commercial use" });
  });

  it("fills terms from the sources list for a result saved before the runs carried them, else says where to read them", () => {
    const old: SearchOutcome = { ...outcome, sources: [] };
    expect(missingTerms(old, sourceTerms(old))).toBe(true);
    const filled = sourceTerms(old, server);
    expect(missingTerms(old, filled)).toBe(false);
    expect(exportRows(old, filled)[0].sourceTerms).toContain("https://ema.example/legal");
    expect(exportRows(old, sourceTerms(old))[0].sourceTerms).toBe(TERMS_FALLBACK);
  });

  it("names files after the search and the day", () => {
    expect(exportFileName(outcome, ctx.generatedAt, "csv")).toBe("medicine-finder_nurofen_europe_2026-10-26.csv");
    expect(exportFileName({ ...outcome, term: "Ibuprofène", country: undefined }, ctx.generatedAt, "json")).toBe("medicine-finder_ibuprofene_all-countries_2026-10-26.json");
  });
});
