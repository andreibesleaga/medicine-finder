import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { preferredName, searchNames, withSynonyms } from "../lib/synonyms.js";
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
    expect(withSynonyms("Acetaminofén").slice(0, 3)).toEqual(["acetaminofen", "paracetamol", "acetaminophen"]);
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

  it("reaches Latin names as registers write them", () => {
    expect(withSynonyms("sodium fluoride")).toEqual(expect.arrayContaining(["natrii fluoride", "natrium fluoride"]));
    expect(withSynonyms("potassium iodide")).toContain("kalii iodide");
    expect(withSynonyms("caffeine")).toContain("coffeinum");
    const store = openStore(":memory:");
    store.replace("lv", [
      { brand: "Paracetamol Lv", ingredient: "Paracetamolum", country: "Latvia" },
      { brand: "Bicarb", ingredient: "Natrii hydrogenocarbonas", country: "Latvia" },
      { brand: "Fluor", ingredient: "Natrii fluoridum", country: "Latvia" },
      { brand: "Calc", ingredient: "Calcii carbonas", country: "Latvia" },
    ], 1);
    const found = (term) => [...new Set(withSynonyms(term).flatMap((n) => store.search("lv", stems(n)).results.map((r) => r.brandName)))];
    expect(found("paracetamol")).toEqual(["Paracetamol Lv"]);
    expect(found("sodium fluoride")).toEqual(["Fluor"]);
    expect(found("calcium carbonate")).toEqual(["Calc"]);
  });

  it("names an ingredient by the first (international) name of its group", () => {
    expect(preferredName("ACETAMINOPHEN")).toBe("Paracetamol");
    expect(preferredName("Paracetamol")).toBe("Paracetamol");
    expect(preferredName("Tamsulosin Hydrochloride")).toBe("Tamsulosin Hydrochloride");
  });

  it("adds the FDA UNII official names, without joining two substances", () => {
    const unii = JSON.parse(readFileSync(new URL("../data/unii-synonyms.json", import.meta.url), "utf8")).groups;
    const seen = new Set();
    for (const name of unii.flat()) {
      expect(name).toBe(name.toLowerCase());
      expect(seen.has(name), name).toBe(false);
      seen.add(name);
    }
    expect(withSynonyms("nitrofurazone")).toContain("nitrofural");
    expect(withSynonyms("inamrinone")).toContain("amrinone");
    // Latin forms that word beginnings already reach are not searched separately
    expect(searchNames("ibuprofen")).toEqual(["ibuprofen"]);
    // hand-made names and UNII names of the same substance come together
    expect(withSynonyms("acetaminophen")).toEqual(expect.arrayContaining(["paracetamol", "acetaminofen", "paracetamolum"]));
  });
});
