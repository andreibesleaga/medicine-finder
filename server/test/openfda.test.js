import { describe, it, expect } from "vitest";
import { createOpenFdaSource, mapOpenFda } from "../sources/openfda.js";
import { stubFetch } from "./helpers.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const label = (brand, generic = "IBUPROFEN") => ({ openfda: { brand_name: [brand], generic_name: [generic], manufacturer_name: ["Haleon"], spl_set_id: ["abc"] } });

describe("openFDA on the server", () => {
  it("is off without a key and says what to set", () => {
    const s = createOpenFdaSource({ fetch: stubFetch([]), env: {} });
    expect(s.enabled()).toBe(false);
    expect(s.status().detail).toMatch(/OPENFDA_API_KEY/);
  });

  it("sends the key, keeps brands, and leaves out labels whose brand is the generic name", async () => {
    const fetch = stubFetch([["api.fda.gov", () => json({ results: [label("Advil"), label("IBUPROFEN"), label("Advil")] })]]);
    const s = createOpenFdaSource({ fetch, env: { OPENFDA_API_KEY: "k123" } });
    expect(s.enabled()).toBe(true);
    const rows = await s.search("ibuprofen");
    expect(rows.map((r) => [r.brandName, r.activeIngredient, r.country, r.manufacturer])).toEqual([["Advil", "ibuprofen", "United States", "Haleon"]]);
    expect(fetch.calls[0].url).toContain("api_key=k123");
  });

  it("answers nothing (not an error) when openFDA has no label", async () => {
    const s = createOpenFdaSource({ fetch: stubFetch([["api.fda.gov", () => json({ error: { code: "NOT_FOUND" } }, 404)]]), env: { OPENFDA_API_KEY: "k" } });
    expect(await s.search("unknown")).toEqual([]);
    expect(mapOpenFda({}, "x")).toEqual([]);
  });
});
