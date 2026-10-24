import { describe, it, expect } from "vitest";
import { rxnorm, openFda, wikidata, pubchem, clinicalTrials } from "@/lib/search/browserSources";
import { jsonResponse, stubFetch } from "./helpers";

describe("RxNorm", () => {
  it("lists brand names related to the ingredient", async () => {
    const fetch = stubFetch([
      ["rxcui.json?name=ibuprofen", () => jsonResponse({ idGroup: { rxnormId: ["5640"] } })],
      ["rxcui/5640/related.json?tty=BN", () => jsonResponse({ relatedGroup: { conceptGroup: [{ tty: "BN", conceptProperties: [{ rxcui: "153010", name: "Advil" }] }] } })],
    ]);
    expect(await rxnorm.search("ibuprofen", fetch)).toEqual([
      {
        brandName: "Advil",
        activeIngredient: "ibuprofen",
        country: "United States",
        url: "https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=153010",
      },
    ]);
  });

  it("returns nothing for unknown ingredients", async () => {
    const fetch = stubFetch([["rxcui.json", () => jsonResponse({ idGroup: {} })]]);
    expect(await rxnorm.search("xyzfoo", fetch)).toEqual([]);
  });
});

describe("openFDA", () => {
  it("searches by ingredient and skips generic-only names and duplicates", async () => {
    const fetch = stubFetch([
      [
        "api.fda.gov",
        () =>
          jsonResponse({
            results: [
              { openfda: { brand_name: ["Ibuprofen"], generic_name: ["IBUPROFEN"] } },
              { openfda: { brand_name: ["Advil"], generic_name: ["IBUPROFEN"], manufacturer_name: ["Haleon"], spl_set_id: ["abc"] } },
              { openfda: { brand_name: ["ADVIL"], generic_name: ["IBUPROFEN"] } },
            ],
          }),
      ],
    ]);
    const rows = await openFda.search("ibuprofen", fetch);
    expect(fetch.calls[0]).toContain('search=openfda.generic_name%3A%22ibuprofen%22+openfda.substance_name%3A%22ibuprofen%22');
    expect(rows).toEqual([
      {
        brandName: "Advil",
        activeIngredient: "ibuprofen",
        country: "United States",
        manufacturer: "Haleon",
        url: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=abc",
      },
    ]);
  });

  it("treats 404 (no match) as no results and other errors as failures", async () => {
    expect(await openFda.search("x", stubFetch([["api.fda.gov", () => jsonResponse({ error: {} }, 404)]]))).toEqual([]);
    await expect(openFda.search("x", stubFetch([["api.fda.gov", () => jsonResponse("", 500)]]))).rejects.toThrow("HTTP 500");
  });
});

describe("Wikidata", () => {
  it("keeps labelled items other than the ingredient itself", async () => {
    const fetch = stubFetch([
      [
        "query.wikidata.org",
        () =>
          jsonResponse({
            results: {
              bindings: [
                { item: { value: "http://www.wikidata.org/entity/Q1" }, itemLabel: { value: "Advil" } },
                { item: { value: "http://www.wikidata.org/entity/Q2" }, itemLabel: { value: "Q2" } },
                { item: { value: "http://www.wikidata.org/entity/Q3" }, itemLabel: { value: "Ibuprofen" } },
              ],
            },
          }),
      ],
    ]);
    const rows = await wikidata.search("ibuprofen", fetch);
    expect(rows.map((r) => r.brandName)).toEqual(["Advil"]);
    // quotes cannot end the SPARQL string literal
    await wikidata.search('ibuprofen"} injected', fetch);
    expect(decodeURIComponent(fetch.calls[1])).toContain('rdfs:label "ibuprofen} injected"@en');
  });
});

describe("PubChem", () => {
  it("keeps brand-like synonyms only", async () => {
    const fetch = stubFetch([
      ["pubchem", () => jsonResponse({ InformationList: { Information: [{ CID: 3672, Synonym: ["ibuprofen", "Ibuprofen", "Advil", "UNII-WK2XYI10QM", "IBU", "Motrin", "Advil"] }] } })],
    ]);
    const rows = await pubchem.search("ibuprofen", fetch);
    expect(rows.map((r) => r.brandName)).toEqual(["Advil", "Motrin"]);
    expect(rows[0].status).toBe("Synonym; may be a brand name");
  });
});

describe("ClinicalTrials.gov", () => {
  it("counts studies with the ingredient as intervention", async () => {
    const fetch = stubFetch([["clinicaltrials.gov/api/v2/studies", () => jsonResponse({ totalCount: 1119, studies: [] })]]);
    expect(await clinicalTrials("ibuprofen", fetch)).toEqual({ count: 1119, url: "https://clinicaltrials.gov/search?intr=ibuprofen" });
  });
});
