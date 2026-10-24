import { describe, it, expect } from "vitest";
import { normalize, validateTerm, stems, matchesSubstance, splitProductName, tidyCase } from "../lib/text.js";

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
    expect(matchesSubstance(s, "AMOXICILLINE TRIHYDRATÉE")).toBe(true);
    expect(matchesSubstance(s, "amoxicilina")).toBe(true);
    expect(matchesSubstance(stems("paracetamol"), "PARACÉTAMOL")).toBe(true);
    expect(matchesSubstance(stems("omeprazole"), "ÉSOMÉPRAZOLE MAGNÉSIQUE")).toBe(false);
    expect(matchesSubstance(stems("insulin glargine"), "insuline glargine")).toBe(true);
    expect(matchesSubstance(stems("insulin glargine"), "insuline asparte")).toBe(false);
    expect(matchesSubstance([], "anything")).toBe(false);
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
