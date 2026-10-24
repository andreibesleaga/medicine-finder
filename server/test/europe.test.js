import { describe, expect, it } from "vitest";
import { parseDkmaRows, splitSubstances } from "../datasets/dkma.js";
import { parseSukl } from "../datasets/sukl.js";
import { parseEma } from "../datasets/ema.js";
import { parseFimea } from "../datasets/fimea.js";

describe("Denmark data quality", () => {
  const header = ["Drugid", "Navn", "Lægemiddelform", "Styrketekst", "AktiveSubstanser", "MftIndehaver", "ATC-kode", "Godkendt procedure", "Er i Medicinpriser"];
  const row = (name, substances, atc) => ["1", name, "tabletter", "", substances, "X", atc, "National", "Nej"];

  it("skips veterinary products (ATC code starting with Q)", () => {
    const rows = parseDkmaRows([header, row("Adaxio Vet.", "PERMETHRIN", "QD08AC52"), row("Panodil", "PARACETAMOL", "N02BE01")]);
    expect(rows.map((r) => r.brand)).toEqual(["Panodil"]);
  });

  it("splits substances on commas outside parentheses and tidies each one", () => {
    expect(splitSubstances("Abacavirhydrochlorid, LAMIVUDIN")).toEqual(["Abacavirhydrochlorid", "Lamivudin"]);
    expect(splitSubstances("INSULIN (isofaninsulin, human), Insulin")).toEqual(["INSULIN (isofaninsulin, human)", "Insulin"]);
    expect(splitSubstances("Denguevirus 1, 2, 3")).toEqual(["Denguevirus 1"]);
  });

  it("never yields an empty ingredient", () => {
    expect(parseDkmaRows([header, row("Odd", " , 2, ", "A01")])).toEqual([]);
  });
});

describe("Czech Republic data quality", () => {
  const base = { KOD_SUKL: "1", NAZEV: "ACYLCOFFIN", SILA: "450MG/50MG", FORMA: "TBL", DRZ: "A", ZEMDRZ: "CZ", REG: "R" };
  const files = (products) => ({
    products,
    composition: products.map((p) => ({ KOD_SUKL: p.KOD_SUKL, KOD_LATKY: "10", S: "L" })),
    substances: [{ KOD_LATKY: "10", NAZEV_EN: "ASPIRIN" }],
    organisations: [
      { ZKR_ORG: "A", ZEM: "CZ", NAZEV: "Zentiva a.s., Praha" },
      { ZKR_ORG: "B", ZEM: "CZ", NAZEV: "Sanofi s.r.o., Praha" },
    ],
    forms: [{ FORMA: "TBL", NAZEV_EN: "Tablet" }],
  });

  it("skips homeopathics and parallel or direct imports", () => {
    const rows = parseSukl(files([base, { ...base, KOD_SUKL: "2", NAZEV: "LUTEINUM", TYP_LP: "HO" }, { ...base, KOD_SUKL: "3", NAZEV: "YAZ", SDOV: "PI/001/15" }]));
    expect(rows.map((r) => r.brand)).toEqual(["Acylcoffin"]);
  });

  it("keeps a second holder of the same name, strength and form", () => {
    const rows = parseSukl(files([base, { ...base, KOD_SUKL: "2", DRZ: "B" }, { ...base, KOD_SUKL: "3" }]));
    expect(rows.map((r) => r.holder)).toEqual(["Zentiva a.s.", "Sanofi s.r.o."]);
  });

  it("lower-cases units in the strength", () => {
    expect(parseSukl(files([base]))[0].strength).toBe("450 mg/50 mg");
    expect(parseSukl(files([{ ...base, SILA: "5MG/ML" }]))[0].strength).toBe("5 mg/ml");
    expect(parseSukl(files([{ ...base, SILA: "100IU" }]))[0].strength).toBe("100IU");
  });
});

describe("EMA data quality", () => {
  it("joins ';'-separated active substances with ' + '", () => {
    const data = [{ category: "Human", medicine_status: "Authorised", name_of_medicine: "Twinrix", active_substance: "hepatitis A virus;hepatitis B surface antigen; " }];
    expect(parseEma({ data })[0].ingredient).toBe("hepatitis A virus + hepatitis B surface antigen");
  });

  it("falls back to the INN when there is no active substance", () => {
    const data = [{ category: "Human", medicine_status: "Authorised", name_of_medicine: "X", active_substance: "", international_non_proprietary_name_common_name: "aspirin" }];
    expect(parseEma({ data })[0].ingredient).toBe("aspirin");
  });
});

describe("Finland data quality", () => {
  const product = (id, name) =>
    `<Pakkaus Laakevalmiste-ref="${id}"><Kaupanolo><Kaupan>1</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
     <Laakevalmiste id="${id}"><Kauppanimi>${name}</Kauppanimi><Vahvuus>1 g</Vahvuus><HUM>1</HUM>
       <Myyntilupa><Haltija>Orion</Haltija><Tila listname="s" id="5" value="x"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>`;
  const xml = (...products) =>
    `<Perusrekisteri>${products.join("")}<Laakeaine id="RES1"><VaikuttavaAine><Aine id="1" value="Ibuprofen"/></VaikuttavaAine></Laakeaine></Perusrekisteri>`;

  it("drops rows that repeat every field", () => {
    expect(parseFimea(xml(product("REL1", "Mysimba"), product("REL2", "Mysimba")))).toHaveLength(1);
  });

  it("tidies all-caps brands and keeps mixed-case ones", () => {
    const rows = parseFimea(xml(product("REL1", "VITA-B6"), product("REL2", "Burana")));
    expect(rows.map((r) => r.brand)).toEqual(["Vita-B6", "Burana"]);
  });
});
