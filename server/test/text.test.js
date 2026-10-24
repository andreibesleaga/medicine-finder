import { describe, it, expect } from "vitest";
import { normalize, validateTerm, stems, decodeXml, splitProductName, tidyCase } from "../lib/text.js";
import { ingredientWords } from "../db/store.js";

// what the database does: every stem must start one of the indexed words of the ingredient
const matches = (termStems, ingredient) => {
  const words = ingredientWords(ingredient);
  return termStems.length > 0 && termStems.every((s) => words.some((w) => w.startsWith(s)));
};

describe("text helpers", () => {
  it("normalizes accents, case and spaces", () => {
    expect(normalize("  IBUPROFÈNE  Lysine ")).toBe("ibuprofene lysine");
  });

  it("accepts ingredient names and rejects markup or overlong input", () => {
    expect(validateTerm("  ibuprofen ")).toBe("ibuprofen");
    expect(validateTerm("insulin glargine")).toBe("insulin glargine");
    expect(validateTerm("acide acétylsalicylique")).toBe("acide acétylsalicylique");
    expect(validateTerm("<script>")).toBeNull();
    expect(validateTerm("a")).toBeNull();
    expect(validateTerm("x".repeat(81))).toBeNull();
    expect(validateTerm(null)).toBeNull();
  });

  it("stems English names so French and Spanish spellings match", () => {
    expect(stems("amoxicillin")).toEqual(["amoxicil"]);
    const s = stems("amoxicillin");
    expect(matches(s, "AMOXICILLINE TRIHYDRATÉE")).toBe(true);
    expect(matches(s, "amoxicilina")).toBe(true);
    expect(matches(stems("paracetamol"), "PARACÉTAMOL")).toBe(true);
    expect(matches(stems("omeprazole"), "ÉSOMÉPRAZOLE MAGNÉSIQUE")).toBe(false);
    expect(matches(stems("insulin glargine"), "insuline glargine")).toBe(true);
    expect(matches(stems("insulin glargine"), "insuline asparte")).toBe(false);
    expect(matches([], "anything")).toBe(false);
  });

  it("splits search terms the way the database indexes words, punctuation included", () => {
    expect(stems("paracetamol (acetaminophen)")).toEqual(["paraceta", "acetaminop"]);
    expect(stems("St. John's wort")).toEqual(["st", "john", "s", "wort"]);
    expect(matches(stems("St. John's wort"), "Hypericum (St John's wort) extract")).toBe(true);
    expect(matches(stems("paracetamol (acetaminophen)"), "Paracetamol / acetaminophen")).toBe(true);
  });

  it("decodes XML entities, numeric ones included", () => {
    expect(decodeXml("Fen &amp; Co &lt;b&gt; &#233;&#x00E9; &quot;x&quot; &apos;y&apos;")).toBe(`Fen & Co <b> éé "x" 'y'`);
    expect(decodeXml("&amp;lt;")).toBe("&lt;");
  });

  it("splits product names into brand, strength and form", () => {
    expect(splitProductName("ADVIL 200 mg, comprimé enrobé")).toEqual({ brand: "ADVIL", strength: "200 mg", form: "comprimé enrobé" });
    expect(splitProductName("DOLIPRANE 2,4 %, suspension buvable")).toEqual({ brand: "DOLIPRANE", strength: "2,4 %", form: "suspension buvable" });
    expect(splitProductName("EFFERALGAN")).toEqual({ brand: "EFFERALGAN", strength: undefined, form: undefined });
  });

  it("title-cases names that are all capitals only", () => {
    expect(tidyCase("IBUPROFENO CINFA")).toBe("Ibuprofeno Cinfa");
    expect(tidyCase("ben-u-ron")).toBe("ben-u-ron");
  });
});
