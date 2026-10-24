// Data-quality rules of the US, Lithuanian and Ukrainian register loaders (fixtures, no network).
import { describe, it, expect } from "vitest";
import { parseNdcProducts } from "../datasets/usfda.js";
import { parseVvkt } from "../datasets/vvkt.js";
import { parseDrlz } from "../datasets/drlz.js";

describe("United States NDC: brands only", () => {
  const head = "PRODUCTTYPENAME\tPROPRIETARYNAME\tNONPROPRIETARYNAME\tDOSAGEFORMNAME\tENDMARKETINGDATE\tMARKETINGCATEGORYNAME\tLABELERNAME\tSUBSTANCENAME\tACTIVE_NUMERATOR_STRENGTH\tACTIVE_INGRED_UNIT\tNDC_EXCLUDE_FLAG";
  const line = (brand, generic, category, end = "", subst = "IBUPROFEN") =>
    ["HUMAN PRESCRIPTION DRUG", brand, generic, "TABLET", end, category, "Lab", subst, "200", "mg/1", "N"].join("\t");
  const brands = (lines, today = new Date("2026-10-24T12:00:00Z")) => parseNdcProducts([head, ...lines].join("\n"), today).map((r) => r.brand);

  it("drops ANDA rows named exactly like the generic, keeps real brands and 'Ibuprofen PM'", () => {
    expect(
      brands([
        line("Flecainide Acetate", "flecainide acetate", "ANDA", "", "FLECAINIDE ACETATE"),
        line("Ibuprofen PM", "Ibuprofen and Diphenhydramine", "ANDA"),
        line("Advil", "Ibuprofen", "NDA"),
        line("Ibuprofen", "Ibuprofen", "OTC MONOGRAPH DRUG"),
      ]),
    ).toEqual(["Ibuprofen PM", "Advil", "Ibuprofen"]);
  });

  it("drops homeopathic and medical gas listings", () => {
    expect(brands([line("Arnica", "Arnica", "UNAPPROVED HOMEOPATHIC"), line("Oxygen", "Oxygen", "UNAPPROVED MEDICAL GAS"), line("Advil", "Ibuprofen", "NDA")])).toEqual(["Advil"]);
  });

  it("keeps a future end date, drops today and past ones, with a fixed clock", () => {
    expect(brands([line("Future", "X", "NDA", "20261025"), line("Today", "X", "NDA", "20261024"), line("Past", "X", "NDA", "20240101")])).toEqual(["Future"]);
  });
});

describe("Lithuania VVKT: ingredients", () => {
  const rec = (vid, name, atc, english, lt = "", extra = {}) => ({ vid, preparato_pav: name, atc_kodas: atc, veikl_angl_pavad: english, veiklioji_medz_lt: lt, stadija: "Registruotas", pak_tiekimo_busena: "Tiekiama", ...extra });
  const pairs = (records) => parseVvkt(records).map((r) => [r.brand, r.ingredient]);

  it("skips parallel imports and parallel distribution", () => {
    expect(
      pairs([
        rec("1", "Nurofen", "M01AE01", "Ibuprofen"),
        rec("2", "Nurofen PI", "M01AE01", "Ibuprofen", "", { tiekimo_lr_rinkai_pagr: "Lygiagretus importas" }),
        rec("3", "Nurofen PD", "M01AE01", "Ibuprofen", "", { tiekimo_lr_rinkai_pagr: "CR-Lygiagretus platinimas" }),
      ]),
    ).toEqual([["Nurofen", "Ibuprofen"]]);
  });

  it("uses the Lithuanian substances for ATC group codes, never the group name", () => {
    expect(pairs([rec("1", "Baneocin", "D06AX", "Other antibiotics for topical use", "Bacitracino cinko kompleksas/Neomicino sulfatas"), rec("2", "Monofer", "B03AC", "Iron, parenteral preparations", "Geležis")])).toEqual([
      ["Baneocin", "Bacitracino cinko kompleksas + Neomicino sulfatas"],
      ["Monofer", "Geležis"],
    ]);
  });

  it("skips a product without ATC code and without a usable name", () => {
    expect(pairs([rec("1", "Bereel", "", "", "Berberis vulgaris D4"), rec("2", "Blank", "", "")])).toEqual([]);
  });

  it("cuts ', combinations' and splits combinations on ' and '", () => {
    expect(pairs([rec("1", "Panadol", "N02BE01", "Paracetamol, combinations excl. psycholeptics"), rec("2", "Tramal", "N02AX52", "Tramadol and paracetamol"), rec("3", "Trio", "C09DX01", "Valsartan, amlodipine and hydrochlorothiazide")])).toEqual([
      ["Panadol", "Paracetamol"],
      ["Tramal", "Tramadol + paracetamol"],
      ["Trio", "Valsartan + amlodipine + hydrochlorothiazide"],
    ]);
  });

  it("keeps vaccine names whole, commas included", () => {
    expect(pairs([rec("1", "Vaxigrip", "J07BB02", "influenza, inactivated, split virus or surface antigen"), rec("2", "Priorix", "J07BD54", "Measles, combinations with mumps, rubella and varicella, live attenuated")])).toEqual([
      ["Vaxigrip", "influenza, inactivated, split virus or surface antigen"],
      ["Priorix", "Measles"],
    ]);
  });
});

describe("Ukraine DRLZ: short form and strength, clean ingredients", () => {
  const rec = (brand, inn, form, holder = "Містрал") => ({
    "Торгівельне найменування": brand, "Міжнародне непатентоване найменування": inn, "Форма випуску": form,
    "Дострокове припинення": "Ні", "Фармакотерапевтична група": "Інші", "Гомеопатичний ЛЗ": "Ні", "Заявник: назва українською": holder,
  });
  const out = (records) => parseDrlz(records).map((r) => [r.brand, r.ingredient, r.form, r.strength]);

  it("cuts the form at ' по ' or the first digit and takes a short strength", () => {
    expect(
      out([
        rec("Кап", "Aciclovir", "капсули по 300 мг, по 10 капсул у блістері"),
        rec("Інф", "Gemcitabine", "порошок для розчину для інфузій, 400 мг/100 мл, по 100 мл у флаконі"),
        rec("Три", "Rosuvastatin", "таблетки, вкриті плівковою оболонкою, 20 мг/4 мг/1,25 мг по 10 таблеток у блістері"),
        rec("Гель", "Diclofenac", "гель по 20 г у тубі; по 1 тубі у коробці"),
      ]),
    ).toEqual([
      ["Кап", "Aciclovir", "капсули", "300 мг"],
      ["Інф", "Gemcitabine", "порошок для розчину для інфузій", "400 мг/100 мл"],
      ["Три", "Rosuvastatin", "таблетки, вкриті плівковою оболонкою", "20 мг/4 мг/1,25 мг"],
      ["Гель", "Diclofenac", "гель", undefined],
    ]);
  });

  it("splits the INN on commas and ' and ', drops 'combinations' parts", () => {
    expect(
      out([
        rec("А", "Lamivudine and abacavir", "таблетки"),
        rec("Б", "Diclofenac, combinations", "гель"),
        rec("В", "Tetanus toxoid, combinations with diphtheria toxoid", "суспензія"),
        rec("Г", "Barbiturates in combination with other drugs", "таблетки"),
      ]).map(([b, i]) => [b, i]),
    ).toEqual([["А", "Lamivudine + abacavir"], ["Б", "Diclofenac"], ["В", "Tetanus toxoid"]]);
  });

  it("deduplicates on brand, ingredient, holder and strength, not on the pack text", () => {
    expect(
      out([
        rec("Х", "Ibuprofen", "таблетки, 200 мг, по 10 таблеток"),
        rec("Х", "Ibuprofen", "таблетки, 200 мг, по 20 таблеток"),
        rec("Х", "Ibuprofen", "таблетки, 400 мг, по 10 таблеток"),
        rec("Х", "Ibuprofen", "таблетки, 200 мг, по 10 таблеток", "Інший"),
      ]).map((r) => r[3]),
    ).toEqual(["200 мг", "400 мг", "200 мг"]);
  });

  it("cuts a brand that carries the pack text", () => {
    expect(out([rec("Аккофіл, По 480 Мкг/0,5 Мл У Шприцах", "Filgrastim", "розчин")])[0][0]).toBe("Аккофіл");
  });
});
