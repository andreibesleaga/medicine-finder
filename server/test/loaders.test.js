// load() of the national datasets that datasets.test.js does not cover: each is fed the smallest
// body its loader accepts through a stubbed fetch (no network), and must request the right URL.
import { describe, it, expect } from "vitest";
import { ema, EMA_URL } from "../datasets/ema.js";
import { bdpm, BDPM_SPEC_URL, BDPM_COMPO_URL } from "../datasets/bdpm.js";
import { aifa, AIFA_URL } from "../datasets/aifa.js";
import { urpl, URPL_URL } from "../datasets/urpl.js";
import { cbg, CBG_URL } from "../datasets/cbg.js";
import { hpra, HPRA_URL } from "../datasets/hpra.js";
import { swissmedic, SWISSMEDIC_URL } from "../datasets/swissmedic.js";
import { dkma, DKMA_URL } from "../datasets/dkma.js";
import { mpa, MPA_URL } from "../datasets/mpa.js";
import { drlz, DRLZ_URL } from "../datasets/drlz.js";
import { maltama, MALTA_URL } from "../datasets/maltama.js";
import { article57, ARTICLE57_URL } from "../datasets/article57.js";
import { usfda, NDC_URL } from "../datasets/usfda.js";
import { invima, INVIMA_URL } from "../datasets/invima.js";
import { tfda, TFDA_URL } from "../datasets/tfda.js";
import { jsonResponse, stubFetch } from "./helpers.js";
import { makeZip } from "./zipfixture.js";

const text = (body) => new Response(body);
const binary = (buf) => new Response(buf, { status: 200, headers: { "content-type": "application/octet-stream" } });
const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A one-sheet .xlsx: text cells go through xl/sharedStrings.xml, as Excel writes them. */
function makeXlsx(rows) {
  const shared = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const sheetRows = rows.map((row, y) => {
    const cells = row.map((value, x) => {
      if (value === "" || value == null) return "";
      shared.push(xmlEscape(String(value)));
      return `<c r="${letters[x]}${y + 1}" t="s"><v>${shared.length - 1}</v></c>`;
    });
    return `<row r="${y + 1}">${cells.join("")}</row>`;
  });
  return makeZip({
    "xl/sharedStrings.xml": `<sst>${shared.map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetRows.join("")}</sheetData></worksheet>`,
  });
}

/** windows-1251 bytes for Cyrillic text (the letters А-я plus і, І, ї, Ї, є, Є); ASCII passes through. */
function cp1251(s) {
  const extra = { "і": 0xb3, "І": 0xb2, "ї": 0xbf, "Ї": 0xaf, "є": 0xba, "Є": 0xaa };
  return Buffer.from([...s].map((c) => {
    const code = c.charCodeAt(0);
    if (extra[c]) return extra[c];
    return code >= 0x410 && code <= 0x44f ? code - 0x350 : code;
  }));
}

const summary = (rows) => rows.map((r) => [r.brand, r.ingredient, r.country]);
const urls = (fetch) => fetch.calls.map((c) => c.url);

describe("dataset load(): JSON, CSV and XML downloads", () => {
  it("EMA: reads the JSON report", async () => {
    const fetch = stubFetch([[EMA_URL, () => jsonResponse({ data: [{ category: "Human", name_of_medicine: "Pedea", medicine_status: "Authorised", active_substance: "Ibuprofen" }] })]]);
    expect(summary(await ema.load(fetch))).toEqual([["Pedea", "Ibuprofen", "European Union"]]);
    expect(urls(fetch)).toEqual([EMA_URL]);
  });

  it("France: fetches both files and decodes ISO-8859-1 accents", async () => {
    const latin1 = (s) => Buffer.from(s, "latin1");
    const spec = "60000001\tADVIL 200 mg, comprimé\tcomprimé\torale\tAutorisation active\tProcédure nationale\tCommercialisée\t01/01/2000\t\t\t PFIZER\tNon";
    const compo = "60000001\tcomprimé\t1\tIBUPROFÈNE\t200 mg\tun comprimé\tSA\t1";
    const fetch = stubFetch([
      [BDPM_COMPO_URL, () => binary(latin1(compo))],
      [BDPM_SPEC_URL, () => binary(latin1(spec))],
    ]);
    expect(summary(await bdpm.load(fetch))).toEqual([["Advil", "Ibuprofène", "France"]]);
    expect(urls(fetch).sort()).toEqual([BDPM_COMPO_URL, BDPM_SPEC_URL].sort());
  });

  it("Italy: reads the semicolon CSV", async () => {
    const csv = [
      "CODICE_AIC;COD_FARMACO;COD_CONFEZIONE;DENOMINAZIONE;DESCRIZIONE;CODICE_DITTA;RAGIONE_SOCIALE;STATO_AMMINISTRATIVO;TIPO_PROCEDURA;FORMA;CODICE_ATC;PA_ASSOCIATI;LINK",
      "1;100;1;BRUFEN;600 MG GRANULATO-30 BUSTINE;1;VIATRIS;Autorizzata;Nazionale;Granulato;M01AE01;IBUPROFENE;",
    ].join("\n");
    const fetch = stubFetch([[AIFA_URL, () => text(csv)]]);
    expect(summary(await aifa.load(fetch))).toEqual([["Brufen", "Ibuprofene", "Italy"]]);
    expect(urls(fetch)).toEqual([AIFA_URL]);
  });

  it("Poland: reads the quoted semicolon CSV", async () => {
    const csv = '"Rodzaj preparatu";"Nazwa Produktu Leczniczego";"Nazwa powszechnie stosowana";"Podmiot odpowiedzialny";"Ważność pozwolenia"\n"Ludzki";"Ibuprom";"Ibuprofenum";"US Pharmacia";"Bezterminowe"\n';
    const fetch = stubFetch([[URPL_URL, () => text(csv)]]);
    const rows = await urpl.load(fetch);
    expect(summary(rows)).toEqual([["Ibuprom", "Ibuprofenum", "Poland"]]);
    expect(rows[0].status).toBe("Authorised (no expiry)");
    expect(urls(fetch)).toEqual([URPL_URL]);
  });

  it("Netherlands: reads the pipe-separated file", async () => {
    const csv = "SOORT|PRODUCTNAAM|WERKZAMESTOFFEN|HANDELSVERGUNNINGHOUDER\nHUM|Brufen 400 mg, tabletten|ibuprofen|Abbott\n";
    const fetch = stubFetch([[CBG_URL, () => text(csv)]]);
    const rows = await cbg.load(fetch);
    expect(rows.map((r) => [r.ingredient, r.country, r.holder])).toEqual([["ibuprofen", "Netherlands", "Abbott"]]);
    expect(rows[0].brand).toMatch(/^Brufen/i);
    expect(urls(fetch)).toEqual([CBG_URL]);
  });

  it("Ireland: reads the XML list and skips products not marketed", async () => {
    const xml =
      "<Products>" +
      "<Product><ProductName>Nurofen 200 mg Tablets</ProductName><ActiveSubstance>Ibuprofen</ActiveSubstance><PAHolder>Reckitt</PAHolder><MarketInfo>Marketed</MarketInfo></Product>" +
      "<Product><ProductName>Gone 5 mg</ProductName><ActiveSubstance>Zed</ActiveSubstance><MarketInfo>Not marketed</MarketInfo></Product>" +
      "</Products>";
    const fetch = stubFetch([[HPRA_URL, () => text(xml)]]);
    const rows = await hpra.load(fetch);
    expect(rows.map((r) => [r.ingredient, r.country, r.holder])).toEqual([["Ibuprofen", "Ireland", "Reckitt"]]);
    expect(rows[0].brand).toMatch(/^Nurofen/);
    expect(urls(fetch)).toEqual([HPRA_URL]);
  });

  it("Colombia: reads the CSV and groups presentations per registration", async () => {
    const csv = [
      "expediente,producto,titular,principioactivo,cantidad,unidadmedida,formafarmaceutica",
      "1,ADVIL® 400 MG TABLETAS,PFIZER SAS,IBUPROFENO,400,MG,TABLETA",
      "1,ADVIL® 400 MG TABLETAS,PFIZER SAS,CAFEINA,65,MG,TABLETA",
    ].join("\n");
    const fetch = stubFetch([[/datos\.gov\.co\/resource\/i7cb-raxc\.csv/, () => text(csv)]]);
    const rows = await invima.load(fetch);
    expect(summary(rows)).toEqual([["Advil", "Ibuprofeno + Cafeina", "Colombia"]]);
    expect(urls(fetch)).toEqual([INVIMA_URL]);
  });

  it("Ukraine: decodes the windows-1251 CSV", async () => {
    const csv = [
      "Торгівельне найменування;Міжнародне непатентоване найменування;Форма випуску;Дострокове припинення;Гомеопатичний ЛЗ;Фармакотерапевтична група;Заявник: назва українською",
      "Нурофен;Ibuprofen;таблетки, 200 мг, по 10 таблеток;Ні;Ні;Аналгетики;Рекітт",
    ].join("\r\n");
    const fetch = stubFetch([[DRLZ_URL, () => binary(cp1251(csv))]]);
    const rows = await drlz.load(fetch);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ingredient: "Ibuprofen", country: "Ukraine", holder: "Рекітт", strength: "200 мг" });
    expect(rows[0].brand.toLowerCase()).toBe("нурофен");
    expect(urls(fetch)).toEqual([DRLZ_URL]);
  });
});

describe("dataset load(): spreadsheet and zip downloads", () => {
  it("Switzerland: reads the first sheet after the header row", async () => {
    // the active substances sit in column Q (index 16)
    const rows17 = [
      Object.assign(Array(17).fill(""), ["Zulassungsnummer", "", "Bezeichnung", "Zulassungsinhaberin"]),
      Object.assign(Array(17).fill(""), ["00001", "", "Dafalgan, Tabletten", "UPSA", ...Array(12).fill(""), "paracetamolum"]),
    ];
    const fetch = stubFetch([[SWISSMEDIC_URL, () => binary(makeXlsx(rows17))]]);
    const rows = await swissmedic.load(fetch);
    expect(rows.map((r) => [r.ingredient, r.country, r.holder])).toEqual([["paracetamolum", "Switzerland", "UPSA"]]);
    expect(rows[0].brand).toMatch(/^Dafalgan/);
    expect(urls(fetch)).toEqual([SWISSMEDIC_URL]);
  });

  it("Denmark: reads the sheet and skips parallel imports", async () => {
    const xlsx = makeXlsx([
      ["Drugid", "Navn", "Lægemiddelform", "Styrketekst", "AktiveSubstanser", "MftIndehaver", "Godkendt procedure", "Er i Medicinpriser"],
      ["1", "Panodil", "Tabletter", "500 mg", "PARACETAMOL", "Haleon", "National", "Ja"],
      ["2", "Panodil import", "Tabletter", "500 mg", "PARACETAMOL", "Orifarm", "Par-Imp", "Nej"],
    ]);
    const fetch = stubFetch([[DKMA_URL, () => binary(xlsx)]]);
    const rows = await dkma.load(fetch);
    expect(summary(rows)).toEqual([["Panodil", "Paracetamol", "Denmark"]]);
    expect(rows[0].status).toBe("Authorised, in the price list");
    expect(urls(fetch)).toEqual([DKMA_URL]);
  });

  it("Sweden: keeps approved human medicines", async () => {
    const xlsx = makeXlsx([
      ["Namn", "Verksamt ämne (förenklat)", "H/V", "Registrerings-status", "Innehavare", "Styrka", "Form", "Försäljningsstatus"],
      ["Alvedon", "Paracetamol", "HUM", "Godkänd", "Haleon", "500 mg", "Tablett", "Finns till försäljning"],
      ["Vet", "Paracetamol", "VET", "Godkänd", "X", "", "", ""],
    ]);
    const fetch = stubFetch([[MPA_URL, () => binary(xlsx)]]);
    const rows = await mpa.load(fetch);
    expect(summary(rows)).toEqual([["Alvedon", "Paracetamol", "Sweden"]]);
    expect(urls(fetch)).toEqual([MPA_URL]);
  });

  it("Malta: reads quoted cells and bracketed headers", async () => {
    const xlsx = makeXlsx([
      [" [Medicine Name]", " [Active Ingredients]", " [Status]", " [Authorization Holder]", " [Pharmaceutical Forms]"],
      [" 'Efudix, cream 50 mg/g'", " 'FLUOROURACIL 50 milligram(s)'", " 'Authorised'", " 'Mylan'", " 'CREAM'"],
    ]);
    const fetch = stubFetch([[MALTA_URL, () => binary(xlsx)]]);
    const rows = await maltama.load(fetch);
    expect(rows.map((r) => [r.ingredient, r.country, r.holder, r.form])).toEqual([["Fluorouracil", "Malta", "Mylan", "Cream"]]);
    expect(rows[0].brand).toMatch(/^Efudix/);
    expect(urls(fetch)).toEqual([MALTA_URL]);
  });

  it("EEA (Article 57): reads the extract below its title rows", async () => {
    const xlsx = makeXlsx([
      ["Article 57 product data"],
      ["Product name", "Active substance", "Route of administration", "Product authorisation country", "Marketing authorisation holder"],
      ["Dolormin", "Ibuprofen", "Oral Use", "Germany", "Johnson & Johnson Gmbh"],
    ]);
    const fetch = stubFetch([[ARTICLE57_URL, () => binary(xlsx)]]);
    const rows = await article57.load(fetch);
    expect(summary(rows)).toEqual([["Dolormin", "Ibuprofen", "Germany"]]);
    expect(urls(fetch)).toEqual([ARTICLE57_URL]);
  });

  it("United States: reads product.txt from the NDC zip, and rejects a zip without it", async () => {
    const header = ["PRODUCTID", "PROPRIETARYNAME", "DOSAGEFORMNAME", "SUBSTANCENAME", "ACTIVE_NUMERATOR_STRENGTH", "ACTIVE_INGRED_UNIT", "LABELERNAME", "PRODUCTTYPENAME", "NDC_EXCLUDE_FLAG", "ENDMARKETINGDATE"];
    const line = ["1", "ADVIL", "TABLET", "IBUPROFEN", "200", "mg/1", "Haleon", "HUMAN OTC DRUG", "N", ""];
    const zip = makeZip({ "product.txt": [header.join("\t"), line.join("\t")].join("\r\n") });
    const fetch = stubFetch([[NDC_URL, () => binary(zip)]]);
    const rows = await usfda.load(fetch);
    expect(summary(rows)).toEqual([["Advil", "Ibuprofen", "United States"]]);
    expect(rows[0].strength).toBe("200 mg/1");
    expect(urls(fetch)).toEqual([NDC_URL]);
    const empty = stubFetch([[NDC_URL, () => binary(makeZip({ "other.txt": "x" }))]]);
    await expect(usfda.load(empty)).rejects.toThrow("product.txt missing");
  });

  it("Taiwan: reads 36_5.json from the zip, and rejects a zip without it", async () => {
    const licence = { "英文品名": "ASPIRIN 100 mg", "主成分略述": "ACETYLSALICYLIC ACID", "註銷狀態": "", "許可證種類": "製　劑", "申請商名稱": "Bayer", "劑型": "錠劑" };
    const cancelled = { ...licence, "英文品名": "OLD", "註銷狀態": "已註銷" };
    const fetch = stubFetch([[TFDA_URL, () => binary(makeZip({ "36_5.json": JSON.stringify([licence, cancelled]) }))]]);
    const rows = await tfda.load(fetch);
    expect(rows.map((r) => [r.ingredient, r.country, r.holder])).toEqual([["Acetylsalicylic Acid", "Taiwan", "Bayer"]]);
    expect(rows[0].brand.toLowerCase()).toBe("aspirin");
    expect(urls(fetch)).toEqual([TFDA_URL]);
    const empty = stubFetch([[TFDA_URL, () => binary(makeZip({ "x.json": "[]" }))]]);
    await expect(tfda.load(empty)).rejects.toThrow("36_5.json missing");
  });
});
