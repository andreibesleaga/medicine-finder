import { describe, expect, it } from "vitest";
import { cutAt, cutAtAmount, cutProductTitle, splitProductName, uniqueRows } from "../lib/text.js";
import { parseInvima } from "../datasets/invima.js";
import { parseTfda } from "../datasets/tfda.js";
import { parseHsa } from "../datasets/hsa.js";
import { parseMaltaRows } from "../datasets/maltama.js";

describe("product title helpers", () => {
  it("cutProductTitle cuts at the first form word or strength", () => {
    const cases = [
      ["Maalox Plus Chewable Tablets", "Maalox Plus"],
      ["CEZOLIN INJECTION 1 gm/vial", "CEZOLIN"],
      ["Cytotec 200 micrograms tablets", "Cytotec"],
      ["BEBEGEL.3830mg/4.5g", "BEBEGEL"],
      ["Angizaar-50mg", "Angizaar"],
      ["Relistor Solution For", "Relistor"],
      ["Chinoin Alin Solucion Inyectable", "Chinoin Alin"],
      ["Griptotal Tabletas", "Griptotal"],
      ["Ezetimibe10 + Simvastatina 40 Tableta Cubierta", "Ezetimibe"],
      ["Acetaminofen500 Mg Tableta Cubierta.", "Acetaminofen"],
      ["Fluconazol200 Mg /", "Fluconazol"],
      ["Domperidona10mg", "Domperidona"],
      ["Quetiapina25 Mgtabletas Recubiertas", "Quetiapina"],
      ["Lactulaxjarabe", "Lactulax"],
      ["Parnido Prolonged-Release", "Parnido"],
      ["Humulin M3 (Mixture 3)", "Humulin M3"],
    ];
    for (const [title, brand] of cases) expect(cutProductTitle(title), title).toBe(brand);
  });

  it("keeps digits that belong to the brand and never cuts to empty", () => {
    expect(cutProductTitle("Vitamin B12 Forte")).toBe("Vitamin B12 Forte");
    expect(cutProductTitle("Gel Plus")).toBe("Gel Plus");
    expect(cutProductTitle("Tablets")).toBe("Tablets");
    expect(cutProductTitle("1% Pred Forte Ophthalmic Suspension")).toBe("1% Pred Forte");
    expect(cutProductTitle("500 Mg")).toBe("500 Mg");
  });

  it("cutAtAmount keeps vitamin names and cuts glued amounts", () => {
    expect(cutAtAmount("Azitromicina Dihidrato551.685 Mg")).toBe("Azitromicina Dihidrato");
    expect(cutAtAmount("Escitalopram Oxalato12.77mg")).toBe("Escitalopram Oxalato");
    expect(cutAtAmount("Warfarin 5 mg")).toBe("Warfarin");
    expect(cutAtAmount("Vitamina B12")).toBe("Vitamina B12");
  });

  it("cutAt takes several patterns and the earliest wins", () => {
    expect(cutAt("Alpha Beta Gamma", /gamma/i, /beta/i)).toBe("Alpha");
    expect(cutAt("Alpha", /alpha/i)).toBe("Alpha");
  });

  it("splitProductName knows gm, units, kiu, mCi and micrograms", () => {
    expect(splitProductName("Cezolin 1 gm/vial").strength).toBe("1 gm/vial");
    expect(splitProductName("Heparin 5000 units/ml").strength).toBe("5000 units/ml");
    expect(splitProductName("Trasylol 500000 kiu").strength).toBe("500000 kiu");
    expect(splitProductName("Cytotec 200 micrograms tablets").brand).toBe("Cytotec");
    expect(splitProductName("Octreoscan 370 mCi").brand).toBe("Octreoscan");
  });

  it("uniqueRows drops exact duplicates only", () => {
    const a = { brand: "A", holder: "X" };
    expect(uniqueRows([a, { ...a }, { ...a, holder: "Y" }])).toEqual([a, { brand: "A", holder: "Y" }]);
  });
});

describe("Colombia names", () => {
  const rec = (producto, principioactivo) => ({ expediente: producto, producto, titular: "X", principioactivo, cantidad: "1", unidadmedida: "mg", formafarmaceutica: "TABLETA" });
  const one = (producto, principioactivo) => parseInvima([rec(producto, principioactivo)])[0];

  it("ingredient loses strengths, 'Equivalente A' text and leading amounts", () => {
    const cases = [
      ["Meropenem Trihidrato Equivalente A Meropenem", "Meropenem Trihidrato"],
      ["Azitromicina Dihidrato551.685 Mg", "Azitromicina Dihidrato"],
      ["Valsartan + Amlodipino Besilato Equivalente A5 Mg Amlodipino Base", "Valsartan + Amlodipino Besilato"],
      ["Escitalopram Oxalato12.77mgequivalente A Escitalopram", "Escitalopram Oxalato"],
      ["Acido Acetilsalicilicoequivalente A", "Acido Acetilsalicilico"],
      ["Morfina Clorhidrato Trihidrato Equivalente A", "Morfina Clorhidrato Trihidrato"],
      ["550 MG DE ACETAMINOFEN", "Acetaminofen"],
    ];
    for (const [raw, ingredient] of cases) expect(one("Marca", raw).ingredient, raw).toBe(ingredient);
  });

  it("brand loses forms and strengths; a number-only ingredient drops the row", () => {
    expect(one("Griptotal Tabletas", "PARACETAMOL").brand).toBe("Griptotal");
    expect(one("Chinoin Alin Solucion Inyectable", "PARACETAMOL").brand).toBe("Chinoin Alin");
    expect(one("Fluconazol200 Mg /", "FLUCONAZOL").brand).toBe("Fluconazol");
    expect(parseInvima([rec("Marca", "525")])).toEqual([]);
  });

  it("exact duplicate registrations collapse", () => {
    expect(parseInvima([rec("Marca", "PARACETAMOL"), { ...rec("Marca", "PARACETAMOL"), expediente: "other" }])).toHaveLength(1);
  });
});

describe("Taiwan names", () => {
  const lic = (en, ingredients = "IBUPROFEN", extra = {}) => ({ 英文品名: en, 中文品名: "中文", 主成分略述: ingredients, 註銷狀態: "", 許可證種類: "製　劑", 申請商名稱: "H", 劑型: "錠劑", 有效日期: "2030/01/01", ...extra });
  const today = new Date("2026-10-24T12:00:00Z");
  const brands = (names) => parseTfda(names.map((n) => lic(n)), today).map((r) => r.brand);

  it("brand loses the form, strength and manufacturer tag", () => {
    expect(brands(['Comycin Injection', 'Sodium Bicarbonate Tablets "f.y."', 'Phenamin Injection "lita"', 'Jexit S.c. Tablets“johnson”', "Neomycin Sulfate Capsules", "Zyceva 150 (Erlotinib Tablets 150mg)", '1% Phenylephrine Hydrochloride Solution "n.y.'])).toEqual([
      "Comycin", "Sodium Bicarbonate", "Phenamin", "Jexit", "Neomycin Sulfate", "Zyceva", "1% Phenylephrine Hydrochloride",
    ]);
  });

  it("a name that starts with a quoted tag only loses the quotes", () => {
    expect(brands(['"BenQ" A25 Hemodialysis'])).toEqual(["BenQ A25 Hemodialysis"]);
  });

  it("ingredient loses '(Eq To ...)' and spells out Hcl", () => {
    const [a, b] = parseTfda([lic("X", "Acetaminophen (Eq To Paracetamol)"), lic("Y", "MELITRACEN HCL")], today);
    expect(a.ingredient).toBe("Acetaminophen");
    expect(b.ingredient).toBe("Melitracen Hydrochloride");
  });

  it("licences past their validity date are skipped, today's still counts", () => {
    const rows = parseTfda([lic("Old", "A", { 有效日期: "2024/05/25" }), lic("Today", "A", { 有效日期: "2026/10/24" }), lic("NoDate", "A", { 有效日期: "" })], today);
    expect(rows.map((r) => r.brand)).toEqual(["Today", "NoDate"]);
  });

  it("exact duplicate rows collapse", () => {
    expect(parseTfda([lic("Same Tablets"), lic("Same Capsules")], today)).toHaveLength(1);
  });
});

describe("Singapore names", () => {
  const rec = (Productname, Activeingredients) => ({ Productname, Activeingredients, Strength: "", Dosageform: "", Licenseholder: "H" });
  const row = (name, ingredients = "X") => parseHsa([rec(name, ingredients)])[0];

  it("brand loses forms in the middle and strengths", () => {
    expect(row("NYSTATIN VAGINAL TABLET 100,000 units").brand).toBe("Nystatin");
    expect(row("CEZOLIN INJECTION 1 gm/vial").brand).toBe("Cezolin");
    expect(row("Relistor Solution For").brand).toBe("Relistor");
    expect(row("Fludarabine Phosphate Powder For Solution For Injection/ Infusion Usp").brand).toBe("Fludarabine Phosphate");
    expect(row("SERETIDE EVOHALER 25/50 mcg").brand).toBe("Seretide Evohaler");
    expect(row("Angizaar-50mg").brand).toBe("Angizaar");
  });

  it("ingredient is cut at the first digit, EQV or '(as'", () => {
    expect(row("A", "SALBUTAMOL SULPHATE 2.41 mg/5 ml EQV SALBUTAMOL BASE").ingredient).toBe("Salbutamol Sulphate");
    expect(row("A", "Warfarin (as warfarin sodium 92% 1.12mg)").ingredient).toBe("Warfarin");
    expect(row("A", "Gemcitabine Hydrochloride 227.6mg eqv Gemcitabine").ingredient).toBe("Gemcitabine Hydrochloride");
  });
});

describe("Malta names", () => {
  const head = ["[Medicine Name]", "[Active Ingredients]", "[Status]"];
  const rows = (...body) => parseMaltaRows([head, ...body.map(([n, i]) => [n, i, "Authorised"])]);

  it("ingredient with a unit word but no amount loses the unit", () => {
    const out = rows(["A", "GLICLAZIDE  milligram(s)"], ["B", "TRYPTOPHAN  gram(s) | GRAMICIDIN 5 microgram(s)"], ["C", "GLUCOSE MONOHYDRATE  gram(s)"]);
    expect(out.map((r) => r.ingredient)).toEqual(["Gliclazide", "Tryptophan + Gramicidin", "Glucose Monohydrate"]);
  });

  it("brand loses forms and strengths", () => {
    expect(rows(["Maalox Plus Chewable Tablets", "X"], ["Cytotec 200 micrograms tablets", "X"], ["FIBRYGA 1g. Powder and solvent for solution", "X"], ["BEBEGEL.3830mg/4.5g", "X"]).map((r) => r.brand)).toEqual(["Maalox Plus", "Cytotec", "FIBRYGA", "BEBEGEL"]);
  });

  it("exact duplicate rows collapse", () => {
    expect(rows(["A Tablets", "X"], ["A Capsules", "X"])).toHaveLength(1);
  });
});
