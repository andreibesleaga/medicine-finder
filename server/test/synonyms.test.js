import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { withSynonyms } from "../lib/synonyms.js";
import { stems } from "../lib/text.js";
import { openStore } from "../db/store.js";

const { groups } = JSON.parse(readFileSync(new URL("../data/synonyms.json", import.meta.url), "utf8"));

describe("ingredient name groups", () => {
  it("are lower case, without accents, in one group only, and short words only where meant", () => {
    const seen = new Set();
    for (const name of groups.flat()) {
      expect(name).toBe(name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim());
      expect(seen.has(name)).toBe(false);
      seen.add(name);
    }
    // a one- or two-letter word must be a whole word in the data ("vitamin c", "cloruro de potasio")
    const shortWords = groups.flat().flatMap((n) => n.split(" ")).filter((w) => w.length < 3);
    expect([...new Set(shortWords)].sort()).toEqual(["c", "de"]);
  });

  it("ignore accents and case in the search term", () => {
    expect(withSynonyms("Acetaminofén")).toEqual(["acetaminofen", "paracetamol", "acetaminophen"]);
  });

  it("find the national spellings that the stems alone miss", () => {
    const store = openStore(":memory:");
    store.replace("x", [
      { brand: "Trombyl", ingredient: "Acetylsalicylsyra", country: "Sweden" },
      { brand: "Hjertemagnyl", ingredient: "Acetylsalicylsyre", country: "Denmark" },
      { brand: "Hydrochloorthiazide Teva", ingredient: "hydrochloorthiazide", country: "Netherlands" },
      { brand: "Klorurodepotasio", ingredient: "Cloruro De Potasio", country: "Colombia" },
      { brand: "Zitromax", ingredient: "Azitromicina", country: "Italy" },
    ], 1);
    const brands = (term) => {
      const found = new Set();
      for (const name of withSynonyms(term)) for (const r of store.search("x", stems(name)).results) found.add(r.brandName);
      return [...found].sort();
    };
    expect(brands("acetylsalicylic acid")).toEqual(["Hjertemagnyl", "Trombyl"]);
    expect(brands("hydrochlorothiazide")).toEqual(["Hydrochloorthiazide Teva"]);
    expect(brands("potassium chloride")).toEqual(["Klorurodepotasio"]);
    expect(brands("azithromycin")).toEqual(["Zitromax"]);
  });
});
