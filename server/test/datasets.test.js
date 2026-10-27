import { describe, it, expect } from "vitest";
import { parseEma } from "../datasets/ema.js";
import { parseBdpm } from "../datasets/bdpm.js";
import { parseAifa } from "../datasets/aifa.js";
import { parseUrpl } from "../datasets/urpl.js";
import { parseCbg } from "../datasets/cbg.js";
import { parseHpra } from "../datasets/hpra.js";
import { parseSwissmedicRows } from "../datasets/swissmedic.js";
import { parseDpd, dpd, DPD_URL } from "../datasets/dpd.js";
import { parseSukl, sukl, SUKL_PAGE } from "../datasets/sukl.js";
import { parseDkmaRows } from "../datasets/dkma.js";
import { parseMpaRows } from "../datasets/mpa.js";
import { parseVvkt, vvkt, VVKT_URL } from "../datasets/vvkt.js";
import { parseDrlz } from "../datasets/drlz.js";
import { parseMaltaRows } from "../datasets/maltama.js";
import { parseArticle57, article57Substances } from "../datasets/article57.js";
import { parseNdcProducts } from "../datasets/usfda.js";
import { parseInvima } from "../datasets/invima.js";
import { parseTfda } from "../datasets/tfda.js";
import { parseHsa, hsa, HSA_POLL_URL } from "../datasets/hsa.js";
import { parsePharmac, pharmac, PHARMAC_INDEX } from "../datasets/pharmac.js";
import { parseFimea, fimea, FIMEA_FILE } from "../datasets/fimea.js";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { curatedRows } from "../datasets/curated.js";
import { searchNames, withSynonyms } from "../lib/synonyms.js";
import { openStore, ingredientWords } from "../db/store.js";
import { createDatasetSources, DATA_FORMAT, PER_COUNTRY, coreIngredient, sameIngredient } from "../datasets/index.js";
import { stems } from "../lib/text.js";
import { fixedClock, stubFetch } from "./helpers.js";
import { makeZip } from "./zipfixture.js";

describe("national dataset parsers", () => {
  it("EMA: authorised human medicines only", () => {
    const rows = parseEma({
      data: [
        { category: "Human", name_of_medicine: "Pedea", medicine_status: "Authorised", active_substance: "Ibuprofen", marketing_authorisation_developer_applicant_holder: "Recordati", medicine_url: "https://ema/pedea" },
        { category: "Human", name_of_medicine: "Old", medicine_status: "Withdrawn", active_substance: "Ibuprofen" },
        { category: "Veterinary", name_of_medicine: "Vet", medicine_status: "Authorised", active_substance: "Ibuprofen" },
      ],
    });
    expect(rows).toEqual([{ brand: "Pedea", ingredient: "Ibuprofen", country: "European Union", holder: "Recordati", status: "Authorised", url: "https://ema/pedea" }]);
    expect(parseEma({})).toEqual([]);
  });

  it("France: marketed products with an active authorisation, substances joined", () => {
    const spec = [
      "60000001\tADVIL 200 mg, comprimé enrobé\tcomprimé enrobé\torale\tAutorisation active\tProcédure nationale\tCommercialisée\t01/01/2000\t\t\t PFIZER HEALTH\tNon",
      "60000002\tOLD 400 mg, comprimé\tcomprimé\torale\tAutorisation active\tProcédure nationale\tNon commercialisée\t01/01/2000\t\t\t X\tNon",
      "60000003\tDOLIPRANE CODEINE, comprimé\tcomprimé\torale\tAutorisation active\tProcédure nationale\tCommercialisée\t01/01/2000\t\t\t OPELLA\tNon",
    ].join("\n");
    const compo = [
      "60000001\tcomprimé\t1\tIBUPROFÈNE\t200 mg\tun comprimé\tSA\t1",
      "60000003\tcomprimé\t2\tPARACÉTAMOL\t400 mg\tun comprimé\tSA\t1",
      "60000003\tcomprimé\t3\tCODÉINE (PHOSPHATE DE) HÉMIHYDRATÉ\t20 mg\tun comprimé\tSA\t2",
      "60000003\tcomprimé\t4\tCODÉINE\t15 mg\tun comprimé\tFT\t2",
    ].join("\r\n");
    const rows = parseBdpm(spec, compo);
    expect(rows.map((r) => [r.brand, r.ingredient, r.strength])).toEqual([
      ["Advil", "Ibuprofène", "200 mg"],
      ["Doliprane Codeine", "Paracétamol + Codéine (Phosphate De) Hémihydraté", undefined],
    ]);
    expect(rows[0].url).toBe("https://base-donnees-publique.medicaments.gouv.fr/medicament/60000001/extrait");
  });

  it("Italy: authorised packs merged per medicine and strength", () => {
    const csv = [
      "CODICE_AIC;COD_FARMACO;COD_CONFEZIONE;DENOMINAZIONE;DESCRIZIONE;CODICE_DITTA;RAGIONE_SOCIALE;STATO_AMMINISTRATIVO;TIPO_PROCEDURA;FORMA;CODICE_ATC;PA_ASSOCIATI;LINK",
      "1;100;1;BRUFEN;600 MG GRANULATO EFFERVESCENTE-30 BUSTINE;1;VIATRIS ITALIA S.R.L.;Autorizzata;Nazionale;Granulato effervescente;M01AE01;IBUPROFENE;",
      "2;100;2;BRUFEN;600 MG GRANULATO EFFERVESCENTE-10 BUSTINE;1;VIATRIS ITALIA S.R.L.;Autorizzata;Nazionale;Granulato effervescente;M01AE01;IBUPROFENE;",
      "3;100;3;BRUFEN; 400 MG COMPRESSE RIVESTITE- 30 COMPRESSE;1;VIATRIS ITALIA S.R.L.;Autorizzata;Nazionale;Compressa rivestita;M01AE01;IBUPROFENE;",
      "4;200;1;MIX;10 BUSTINE;2;ACME;Sospesa;Nazionale;Tisana;A06;MENTOLO/CANFORA;",
    ].join("\n");
    expect(parseAifa(csv).map((r) => [r.brand, r.ingredient, r.strength, r.holder])).toEqual([
      ["Brufen", "Ibuprofene", "600 mg", "Viatris Italia S.r.l."],
      ["Brufen", "Ibuprofene", "400 mg", "Viatris Italia S.r.l."],
    ]);
  });

  it("Poland: human products with the Latin INN and SmPC link", () => {
    const head = '"Nazwa Produktu Leczniczego";"Nazwa powszechnie stosowana";"Rodzaj preparatu";"Moc";"Postać farmaceutyczna";"Ważność pozwolenia";"Podmiot odpowiedzialny";"Substancja czynna";"Charakterystyka";"Ulotka"';
    const rows = parseUrpl(
      [
        head,
        '"Metafen Ibuprofen";"Ibuprofenum";"Ludzki";"200 mg";"Tabletki powlekane";"Bezterminowe";"POLPHARMA S.A.";"Ibuprofenum 200 mg";"https://rpl/1561/characteristic";"https://rpl/1561/leaflet"',
        '"Vet";"Ibuprofenum";"Weterynaryjny";"";"";"";"";"";"";""',
      ].join("\n"),
    );
    expect(rows).toEqual([
      {
        brand: "Metafen Ibuprofen",
        ingredient: "Ibuprofenum",
        country: "Poland",
        holder: "POLPHARMA S.A.",
        strength: "200 mg",
        form: "Tabletki powlekane",
        status: "Authorised (no expiry)",
        url: "https://rpl/1561/characteristic",
      },
    ]);
  });

  it("Netherlands: skips homeopathics, splits name, decodes status", () => {
    const head = "REGISTRATIENUMMER|SOORT|PRODUCTNAAM|HANDELSVERGUNNINGHOUDER|AFLEVERSTATUS|FARMACEUTISCHEVORM|POTENTIE|WERKZAMESTOFFEN|PRODUCTDETAIL_LINK";
    const rows = parseCbg(
      [
        head,
        "28755|RVG |DA Ibuprofen 400 mg, omhulde tablet|Drogisterij B.V.|Uitsluitend apotheek$SEMICOLON$ UAD|Filmomhulde tablet||IBUPROFEN|https://cbg/rvg28755",
        "1|RVH|Homeo 4CH, globuli|X|Zelfzorg|Globuli||ARNICA|",
      ].join("\n"),
    );
    expect(rows).toEqual([
      {
        brand: "DA Ibuprofen",
        ingredient: "Ibuprofen",
        country: "Netherlands",
        holder: "Drogisterij B.V.",
        strength: "400 mg",
        form: "Filmomhulde tablet",
        status: "Uitsluitend apotheek; UAD",
        url: "https://cbg/rvg28755",
      },
    ]);
  });

  it("Ireland: authorised products, not those marked not marketed", () => {
    const xml = `<Products xmlns="x"><Product><ProductName>Actiprofen 200 mg tablets</ProductName><PAHolder>Haleon &amp; Co</PAHolder>
      <MarketInfo>Marketed</MarketInfo><DosageForm>Film-coated tablet</DosageForm>
      <ActiveSubstances><ActiveSubstance>Ibuprofen</ActiveSubstance></ActiveSubstances></Product>
      <Product><ProductName>Gone 5 mg tablets</ProductName><MarketInfo>Not marketed</MarketInfo><ActiveSubstances><ActiveSubstance>X</ActiveSubstance></ActiveSubstances></Product></Products>`;
    expect(parseHpra(xml)).toEqual([
      { brand: "Actiprofen", ingredient: "Ibuprofen", country: "Ireland", holder: "Haleon & Co", strength: "200 mg tablets", form: "Film-coated tablet", status: "Authorised, marketed" },
    ]);
  });

  it("Switzerland: finds the header row and merges packs", () => {
    const rows = [
      ["", "", "", "Zugelassene Packungen"],
      ["Zulassungs-nummer", "Dosis", "Bezeichnung", "Inhaberin"],
      ["62", "1", "Dafalgan 500 mg, Tabletten", "UPSA Switzerland AG", ...Array(12).fill(""), "paracetamolum"],
      ["62", "1", "Dafalgan 500 mg, Tabletten", "UPSA Switzerland AG", ...Array(12).fill(""), "paracetamolum"],
      ["70", "1", "Combo, Kapseln", "X AG", ...Array(12).fill(""), "paracetamolum, coffeinum"],
    ];
    expect(parseSwissmedicRows(rows).map((r) => [r.brand, r.strength, r.form, r.ingredient])).toEqual([
      ["Dafalgan", "500 mg", "Tabletten", "paracetamolum"],
      ["Combo", undefined, "Kapseln", "paracetamolum + coffeinum"],
    ]);
    expect(() => parseSwissmedicRows([["no header"]])).toThrow("header row not found");
  });

  it("Canada: marketed human products from the extract, salts dropped, DIN owner as holder", () => {
    const files = {
      drug: ['"1","","Human","02242345","ADVIL","","N","","1","","","Humain","",""', '"2","","Veterinary","0001","VETPROF"', '"3","","Human","0002","OLDPROF"'].join("\n"),
      ingred: ['"1","2609","IBUPROFEN (IBUPROFEN SODIUM)","I","200","MG"', '"2","2609","IBUPROFEN","I","100","MG"', '"3","2609","IBUPROFEN","I","100","MG"'].join("\n"),
      comp: ['"1","","1","MAILER INC","MAILING"', '"1","","2","HALEON CANADA ULC","DIN_OWNER"'].join("\n"),
      form: '"1","5","TABLET","Comprimé"',
      status: ['"1","N","APPROVED"', '"1","Y","MARKETED"', '"2","Y","MARKETED"', '"3","Y","CANCELLED POST MARKET"'].join("\r\n"),
    };
    expect(parseDpd(files)).toEqual([
      {
        brand: "Advil",
        ingredient: "Ibuprofen",
        country: "Canada",
        holder: "Haleon Canada Ulc",
        strength: "200 MG",
        form: "Tablet",
        status: "Marketed",
        url: "https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=1",
      },
    ]);
  });

  it("Czech Republic: registered packs merged per name, strength and form; English substance names", () => {
    const files = {
      products: [
        { KOD_SUKL: "1", NAZEV: "IBUMAX", SILA: "200MG", FORMA: "TBL FLM", DRZ: "VIB", ZEMDRZ: "FIN", REG: "R" },
        { KOD_SUKL: "2", NAZEV: "IBUMAX", SILA: "200MG", FORMA: "TBL FLM", DRZ: "VIB", ZEMDRZ: "FIN", REG: "R" },
        { KOD_SUKL: "3", NAZEV: "PARALEN PLUS", SILA: "", FORMA: "TBL", DRZ: "OPL", ZEMDRZ: "CZ", REG: "B" },
        { KOD_SUKL: "4", NAZEV: "GONE", SILA: "1MG", FORMA: "TBL", DRZ: "OPL", ZEMDRZ: "CZ", REG: "C" },
      ],
      composition: [
        { KOD_SUKL: "1", KOD_LATKY: "10", S: "L" },
        { KOD_SUKL: "1", KOD_LATKY: "99", S: "X" },
        { KOD_SUKL: "2", KOD_LATKY: "10", S: "L" },
        { KOD_SUKL: "3", KOD_LATKY: "20", S: "L" },
        { KOD_SUKL: "3", KOD_LATKY: "30", S: "L" },
        { KOD_SUKL: "4", KOD_LATKY: "10", S: "L" },
      ],
      substances: [
        { KOD_LATKY: "10", NAZEV_INN: "IBUPROFENUM", NAZEV_EN: "IBUPROFEN" },
        { KOD_LATKY: "20", NAZEV_INN: "PARACETAMOLUM", NAZEV_EN: "PARACETAMOL" },
        { KOD_LATKY: "30", NAZEV_INN: "COFFEINUM", NAZEV_EN: "" },
        { KOD_LATKY: "99", NAZEV_INN: "LACTOSUM", NAZEV_EN: "LACTOSE" },
      ],
      organisations: [
        { ZKR_ORG: "VIB", ZEM: "FIN", NAZEV: "Vitabalans Oy, Hämeenlinna" },
        { ZKR_ORG: "OPL", ZEM: "CZ", NAZEV: "Opella Healthcare Czech s.r.o., Praha" },
      ],
      forms: [
        { FORMA: "TBL FLM", NAZEV_EN: "Film-coated tablet" },
        { FORMA: "TBL", NAZEV_EN: "Tablet" },
      ],
    };
    expect(parseSukl(files)).toEqual([
      { brand: "Ibumax", ingredient: "Ibuprofen", country: "Czech Republic", holder: "Vitabalans Oy", strength: "200 mg", form: "Film-coated tablet", status: "Registered" },
      { brand: "Paralen Plus", ingredient: "Paracetamol + Coffeinum", country: "Czech Republic", holder: "Opella Healthcare Czech s.r.o.", strength: undefined, form: "Tablet", status: "Registered" },
    ]);
  });

  it("Denmark: authorised products, no parallel imports, price-list flag as status", () => {
    const header = ["Drugid", "Navn", "Lægemiddelform", "Styrketekst", "AktiveSubstanser", "MftIndehaver", "ATC-kode", "Godkendt procedure", "Godkendt rolle", "Registreringsdato", "Er i Medicinpriser"];
    const rows = [
      header,
      ["1", "Brufen", "filmovertrukne tabletter", "600 mg", "IBUPROFEN", "Viatris ApS", "M01AE01", "National", "DKMA", "30018", "Ja"],
      ["2", "Brufen", "filmovertrukne tabletter", "600 mg", "IBUPROFEN", "Importer ApS", "M01AE01", "Par-Imp", "", "30019", "Ja"],
      ["3", "Combo \"Stada\"", "tabletter", "600+300 mg", "Abacavir, LAMIVUDIN", "STADA Arzneimittel AG", "J05AR02", "MRP", "CMS", "42536", "Nej"],
      ["4", "Vitaminpille", "tabletter", "", "C-VITAMIN", "X", "", "Vitamin", "", "1", "Nej"],
    ];
    expect(parseDkmaRows(rows)).toEqual([
      { brand: "Brufen", ingredient: "Ibuprofen", country: "Denmark", holder: "Viatris ApS", strength: "600 mg", form: "filmovertrukne tabletter", status: "Authorised, in the price list" },
      { brand: 'Combo "Stada"', ingredient: "Abacavir + Lamivudin", country: "Denmark", holder: "STADA Arzneimittel AG", strength: "600+300 mg", form: "tabletter", status: "Authorised" },
    ]);
    expect(() => parseDkmaRows([["Navn"]])).toThrow("header row not found");
  });

  it("Sweden: approved human medicines, no parallel imports, deregistered or homeopathic", () => {
    const header = ["Namn", "Styrka", "Form", "ATC-kod", "Verksamt ämne (förenklat)", "Verksamt ämne", "Registrerings-status", "Godkännande-datum", "Avregistrerings-datum", "Tillfälligt återkallad, datum", "Restsituation", "Försäljningsstatus", "Innehavare", "H/V", "Djurslag", "Parallellimport", "Direktimporterat läkemedel", "Avvikelse från direktimporterat läkemedel", "Receptstatus", "Narkotika", "Särskilda regler för biv.rap.", "Ombud", "MT-nummer", "NPL-id", "Godkännande-procedur", "EUMA-nummer", "Produktkategori"];
    const row = (name, status, hv, parallel, category, onSale, substance = "Ibuprofen") => {
      const r = Array(header.length).fill("");
      Object.assign(r, { 0: name, 1: "400 mg", 2: "Tablett", 4: substance, 6: status, 11: onSale, 12: "Viatris AB", 13: hv, 15: parallel, 26: category });
      return r;
    };
    const rows = [
      header,
      row("Brufen", "Godkänd", "HUM", "", "Läkemedel", "Finns till försäljning"),
      row("Brufen", "Godkänd", "HUM", "Importer AB", "Läkemedel", "Finns till försäljning"),
      row("Old", "Avregistrerad", "HUM", "", "Läkemedel", "Ej aktuellt"),
      row("Vetprofen", "Godkänd", "VET", "", "Läkemedel", "Ej aktuellt"),
      row("Homeo", "Registrerad", "HUM", "", "Homeopatiskt läkemedel", "Ej aktuellt"),
      row("Combo", "Registrerad", "HUM", "", "Läkemedel", "Ej aktuellt", "Abakavir + lamivudin"),
    ];
    expect(parseMpaRows(rows)).toEqual([
      { brand: "Brufen", ingredient: "Ibuprofen", country: "Sweden", holder: "Viatris AB", strength: "400 mg", form: "Tablett", status: "Approved, on sale" },
      { brand: "Combo", ingredient: "Abakavir + lamivudin", country: "Sweden", holder: "Viatris AB", strength: "400 mg", form: "Tablett", status: "Approved" },
    ]);
    expect(() => parseMpaRows([["Name"]])).toThrow("header row not found");
  });

  it("Lithuania: one row per product, supplied when any package is, deregistered left out", () => {
    const pack = (vid, name, stadija, supply, substance = "Ibuprofen") => ({ vid, preparato_pav: name, atc_kodas: "M01AE01", veikl_angl_pavad: substance, stiprumas: "400 mg", farmacine_forma_lt: "tabletės", stadija, pak_tiekimo_busena: supply, registruotojas: "Reckitt" });
    expect(
      parseVvkt([
        pack("1", "Nurofen", "Registruotas", "Netiekiama"),
        pack("1", "Nurofen", "Registruotas", "Tiekiama"),
        pack("2", "Gone", "Išregistruotas", "Netiekiama"),
        pack("3", "Trio", "Perregistruotas", "Netiekiama", "Valsartan, amlodipine and hydrochlorothiazide"),
      ]).map((r) => [r.brand, r.ingredient, r.status]),
    ).toEqual([
      ["Nurofen", "Ibuprofen", "Registered, supplied"],
      ["Trio", "Valsartan + amlodipine + hydrochlorothiazide", "Registered"],
    ]);
  });

  it("Ukraine: INN as ingredient, early terminations, substances and homeopathics left out", () => {
    const rec = (brand, inn, form, stopped = "Ні", group = "Анальгетики", homeo = "Ні") => ({
      "Торгівельне найменування": brand, "Міжнародне непатентоване найменування": inn, "Форма випуску": form,
      "Дострокове припинення": stopped, "Фармакотерапевтична група": group, "Гомеопатичний ЛЗ": homeo, "Заявник: назва українською": "Містрал",
    });
    expect(
      parseDrlz([
        rec("АПІРОЛ", "Ibuprofen", "розчин для інфузій, 400 мг/100 мл, по 100 мл у флаконі"),
        rec("АФФИДА", "Ibuprofen", "таблетки, вкриті плівковою оболонкою, по 10 таблеток"),
        rec("СТАРИЙ", "Ibuprofen", "таблетки, 200 мг", "Так"),
        rec("ІБУПРОФЕН", "Ibuprofen", "порошок (субстанція) у пакетах", "Ні", "Субстанції."),
        rec("ГОМЕО", "Ibuprofen", "краплі, 10 мл", "Ні", "Інші", "Так"),
      ]).map((r) => [r.brand, r.ingredient, r.form, r.strength]),
    ).toEqual([
      ["Апірол", "Ibuprofen", "розчин для інфузій", "400 мг/100 мл"],
      ["Аффида", "Ibuprofen", "таблетки, вкриті плівковою оболонкою", undefined],
    ]);
  });

  it("Malta: quoted cells cleaned, authorised only, ingredient amounts dropped", () => {
    const rows = [
      ["[Medicine Name]", " [Active Ingredients]", " [Pharmaceutical Forms]", " [Therapeutic Class]", " [Classification]", " [ATC Code]", " [Status]", " [Authorisation Number]", " [Authorisation Date]", " [Authorization Holder]"],
      ["'Efudix, cream 50 mg/g'", " 'FLUOROURACIL 50 milligram(s)/gram'", " 'CREAM'", "", "", "", " 'Authorised'", "", "", " 'EJ Busuttil Ltd'"],
      ["'Rennie 680mg/80mg Chewable Tablets'", " 'CALCIUM CARBONATE 680 milligram(s) | MAGNESIUM CARBONATE, HEAVY 80 milligram(s)'", " 'CHEWABLE TABLET'", "", "", "", " 'Authorised'", "", "", " 'NM Pharma'"],
      ["'Old 5 mg tablets'", " 'X 5 milligram(s)'", " 'TABLET'", "", "", "", " 'Withdrawn'", "", "", " 'Y'"],
    ];
    expect(parseMaltaRows(rows).map((r) => [r.brand, r.ingredient, r.form, r.holder])).toEqual([
      ["Efudix", "Fluorouracil", "Cream", "EJ Busuttil Ltd"],
      ["Rennie", "Calcium Carbonate + Magnesium Carbonate, Heavy", "Chewable Tablet", "NM Pharma"],
    ]);
  });

  it("EEA (Article 57): header found by its text, countries with their own data skipped, routes merged", () => {
    const rows = [
      ["Data as present in the Article 57 database on 09/10/2026", ""],
      ["EMA/518502/2018, Rev.90", ""],
      ["Product name\r\n\r\nProduct short name: brand name or the combination of the generic name and the company name", "Active substance\r\n\r\nThe symbol \"|\" is used to separate different pharmaceutical products", "Route of administration", "Product authorisation country", "Marketing authorisation holder", "Pharmacovigilance system master file location", "Pharmacovigilance enquiries email address", "Pharmacovigilance enquiries telephone number"],
      ["Dolormin", "Ibuprofen", "Oral Use", "Germany", "Johnson & Johnson Gmbh", "Germany", "pv@example.com", "+49 1"],
      ["Dolormin", "Ibuprofen", "Rectal Use", "Germany", "Johnson & Johnson Gmbh", "Germany", "pv@example.com", "+49 1"],
      ["Aarane N", "Reproterol Hydrochloride, Sodium Cromoglicate", "Inhalation Use", "Germany", "Hormosan Pharma Gmbh", "Germany", "", ""],
      ["Citalopram Clydesdale Pharma", "Citalopram Hydrobromide", "Oral Use", "Portugal", "Clydesdale", "", "", ""],
      ["Aaa Sore Throat", "Benzocaine", "Oromucosal Use", "United Kingdom (Northern Ireland)", "Manx Healthcare Ltd", "", "", ""],
      ["Nurofen", "Ibuprofen", "Oral Use", "France", "Reckitt", "", "", ""],
      ["Somecentral", "Ibuprofen", "Oral Use", "European Union", "X", "", "", ""],
      ["", "Ibuprofen", "Oral Use", "Austria", "X", "", "", ""],
    ];
    const out = parseArticle57(rows);
    expect(out.map((r) => [r.brand, r.ingredient, r.country, r.holder, r.status])).toEqual([
      ["Dolormin", "Ibuprofen", "Germany", "Johnson & Johnson Gmbh", "Authorised"],
      ["Aarane N", "Reproterol Hydrochloride + Sodium Cromoglicate", "Germany", "Hormosan Pharma Gmbh", "Authorised"],
      ["Citalopram Clydesdale Pharma", "Citalopram Hydrobromide", "Portugal", "Clydesdale", "Authorised; generic name and company"],
      ["Aaa Sore Throat", "Benzocaine", "United Kingdom", "Manx Healthcare Ltd", "Authorised in Northern Ireland"],
    ]);
    // the contact columns are never copied
    expect(JSON.stringify(out)).not.toMatch(/pv@example|\+49/);
    // a name with a second language after a line break is kept on one line
    const twoLines = parseArticle57([rows[2], ["Aflu \r\nафлу Капки", "Oxymetazoline", "Nasal Use", "Bulgaria", "Tays\r\nPharma", "", "", ""]]);
    expect(twoLines.map((r) => [r.brand, r.holder])).toEqual([["Aflu афлу Капки", "Tays Pharma"]]);
    // a trailing comma in the register's name is dropped
    expect(parseArticle57([rows[2], ["Imidin Für Kinder,", "Xylometazoline", "Nasal Use", "Germany", "X", "", "", ""]])[0].brand).toBe("Imidin Für Kinder");
  });

  it("EEA (Article 57): substances split on | and commas, herbal descriptions kept whole", () => {
    expect(article57Substances("Abiraterone Acetate | Prednisolone")).toEqual(["Abiraterone Acetate", "Prednisolone"]);
    expect(article57Substances("Calcium Carbonate, Cholecalciferol Concentrate | Risedronate Sodium")).toEqual(["Calcium Carbonate", "Cholecalciferol Concentrate", "Risedronate Sodium"]);
    expect(article57Substances("Vitamin A Concentrate (Oily Form), Synthetic")).toEqual(["Vitamin A Concentrate (Oily Form)", "Synthetic"]);
    const herbal = "Tincture From Agnus Castus Fruit (1:10), Extraction Solvent: Ethanol 69.5% V/V";
    expect(article57Substances(herbal)).toEqual([herbal]);
    expect(() => parseArticle57([["no header here"]])).toThrow(/header row not found/);
  });

  it("United States: marketed human products, excluded and ended listings left out", () => {
    const head = "PRODUCTID\tPRODUCTNDC\tPRODUCTTYPENAME\tPROPRIETARYNAME\tPROPRIETARYNAMESUFFIX\tNONPROPRIETARYNAME\tDOSAGEFORMNAME\tROUTENAME\tSTARTMARKETINGDATE\tENDMARKETINGDATE\tMARKETINGCATEGORYNAME\tAPPLICATIONNUMBER\tLABELERNAME\tSUBSTANCENAME\tACTIVE_NUMERATOR_STRENGTH\tACTIVE_INGRED_UNIT\tPHARM_CLASSES\tDEASCHEDULE\tNDC_EXCLUDE_FLAG";
    const line = (type, name, end, flag, subst = "IBUPROFEN", str = "200", unit = "mg/1") => ["1", "0001-1", type, name, "", "", "TABLET, FILM COATED", "ORAL", "20200101", end, "NDA", "", "Haleon", subst, str, unit, "", "", flag].join("\t");
    const text = [
      head,
      line("HUMAN OTC DRUG", "Advil", "", "N"),
      line("HUMAN OTC DRUG", "Advil", "", "N"),
      line("HUMAN OTC DRUG", "good sense ibuprofen pm", "", "N", "DIPHENHYDRAMINE CITRATE; IBUPROFEN", "38; 200", "mg/1; mg/1"),
      line("HUMAN PRESCRIPTION DRUG", "Ended", "20240101", "N"),
      line("HUMAN PRESCRIPTION DRUG", "Excluded", "", "E"),
      line("BULK INGREDIENT", "Raw", "", "N"),
    ].join("\n");
    expect(parseNdcProducts(text).map((r) => [r.brand, r.ingredient, r.strength, r.form, r.status])).toEqual([
      ["Advil", "Ibuprofen", "200 mg/1", "Tablet, Film Coated", "Listed, over the counter"],
      ["Good Sense Ibuprofen Pm", "Diphenhydramine Citrate + Ibuprofen", "38 mg/1 / 200 mg/1", "Tablet, Film Coated", "Listed, over the counter"],
    ]);
  });

  it("Colombia: one row per registration, ingredients of all its rows joined", () => {
    const rec = (expediente, producto, principioactivo, cantidad) => ({ expediente, producto, titular: "HALEON COLOMBIA S.A.S", principioactivo, cantidad, unidadmedida: "mg", formafarmaceutica: "TABLETA RECUBIERTA" });
    expect(
      parseInvima([
        rec("1", "ADVIL® 400 MG TABLETAS", "IBUPROFENO", "400"),
        rec("1", "ADVIL® 400 MG TABLETAS", "IBUPROFENO", "400"),
        rec("2", "BUSCAPINA FEM", "HIOSCINA N-BUTIL BROMURO", "20"),
        rec("2", "BUSCAPINA FEM", "IBUPROFENO GRANULADO (IBUPROFENO 85% + CELULOSA) 235.3 MG", "400"),
      ]).map((r) => [r.brand, r.ingredient, r.strength]),
    ).toEqual([
      ["Advil", "Ibuprofeno", "400 mg"],
      ["Buscapina Fem", "Hioscina N-Butil Bromuro + Ibuprofeno Granulado", "20 mg / 400 mg"],
    ]);
  });

  it("Taiwan: current licences for finished products, English names, strength split off", () => {
    const lic = (en, ingredients, kind = "製　劑", cancelled = "") => ({ 英文品名: en, 中文品名: "中文", 主成分略述: ingredients, 註銷狀態: cancelled, 許可證種類: kind, 申請商名稱: "元聖企業", 劑型: "膜衣錠" });
    expect(
      parseTfda([
        lic("IbuKern 600mg film-coated tablets", "IBUPROFEN"),
        lic("Old 400mg tablets", "IBUPROFEN", "製　劑", "已註銷"),
        lic("IBUPROFEN", "IBUPROFEN", "原料藥"),
        lic("RIFON OIL", "METHYL SALICYLATE;;MENTHOL"),
      ]).map((r) => [r.brand, r.ingredient, r.strength]),
    ).toEqual([
      ["IbuKern", "Ibuprofen", "600mg film-coated tablets"],
      ["Rifon Oil", "Methyl Salicylate + Menthol", undefined],
    ]);
  });

  it("Singapore: brand without strength or trailing form word; && separates ingredients", () => {
    const rec = (Productname, Activeingredients, Strength, Dosageform) => ({ Productname, Activeingredients, Strength, Dosageform, Licenseholder: "GOLDPLUS UNIVERSAL PTE LTD" });
    expect(
      parseHsa([rec("FUCON CAPSULE 10 mg", "HYOSCINE N-BUTYLBROMIDE", "10 mg", "CAPSULE"), rec("INON GRANULES", "CALCIUM CARBONATE&&SODIUM BICARBONATE", "497 mg&&600 mg", "GRANULE")]).map((r) => [r.brand, r.ingredient, r.strength]),
    ).toEqual([
      ["Fucon", "Hyoscine N-Butylbromide", "10 mg"],
      ["Inon", "Calcium Carbonate + Sodium Bicarbonate", "497 mg / 600 mg"],
    ]);
  });

  it("New Zealand: chemical, formulation and brand from the schedule XML", () => {
    const xml = `<Schedule><Chemical ID="C1"><Name>Ibuprofen</Name>
      <Formulation ID="F1"><Name>Tab 200 mg</Name><Brand ID="B1"><Name>Relieve</Name><Pack ID="P1"><Quantity>20</Quantity></Pack></Brand>
      <Brand ID="B2"><Name>Nurofen &amp; Co</Name></Brand></Formulation></Chemical></Schedule>`;
    expect(parsePharmac(xml)).toEqual([
      { brand: "Relieve", ingredient: "Ibuprofen", country: "New Zealand", strength: "Tab 200 mg", status: "Funded (Pharmaceutical Schedule)" },
      { brand: "Nurofen & Co", ingredient: "Ibuprofen", country: "New Zealand", strength: "Tab 200 mg", status: "Funded (Pharmaceutical Schedule)" },
    ]);
  });

  it("Finland: current human authorisations joined to their substances through the packages", () => {
    // left out: REL3 withdrawn, REL4 parallel import, REL5 veterinary, REL6 no name, REL7 no packages
    const xml = `<Perusrekisteri>
      <Pakkaus Laakevalmiste-ref="REL1"><Kaupanolo><Kaupan>0</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
      <Pakkaus Laakevalmiste-ref="REL1"><Kaupanolo><Kaupan>1</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
      <Pakkaus Laakevalmiste-ref="REL2"><Kaupanolo><Kaupan>0</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES2"/></Pakkaus>
      <Pakkaus Laakevalmiste-ref="REL3"><Kaupanolo><Kaupan>1</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
      <Pakkaus Laakevalmiste-ref="REL4"><Kaupanolo><Kaupan>1</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
      <Laakevalmiste id="REL1"><Kauppanimi>Burana</Kauppanimi><Vahvuus>400 mg</Vahvuus><Laakemuoto listname="DosageForm" id="235" value="tabletti, kalvopäällysteinen"/><HUM>1</HUM>
        <Myyntilupa><Haltija>Orion Corporation</Haltija><Tila listname="Authorisation Status" id="5" value="Myyntilupa myönnetty"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
      <Laakevalmiste id="REL2"><Kauppanimi>Burana-C</Kauppanimi><HUM>1</HUM>
        <Myyntilupa><Haltija>Orion &amp; Co</Haltija><Tila listname="Authorisation Status" id="18" value="Rekisteröinti myönnetty"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
      <Laakevalmiste id="REL3"><Kauppanimi>Old</Kauppanimi><HUM>1</HUM>
        <Myyntilupa><Tila listname="Authorisation Status" id="6" value="Myyntilupa peruuntunut"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
      <Laakevalmiste id="REL4"><Kauppanimi>Imported</Kauppanimi><HUM>1</HUM>
        <Myyntilupa><Tila listname="Authorisation Status" id="5" value="Myyntilupa myönnetty"/><RinnakkaisTuonti>1</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
      <Pakkaus Laakevalmiste-ref="REL5"><Kaupanolo><Kaupan>1</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
      <Pakkaus Laakevalmiste-ref="REL6"><Kaupanolo><Kaupan>1</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
      <Laakevalmiste id="REL5"><Kauppanimi>Veterinary</Kauppanimi><HUM>0</HUM>
        <Myyntilupa><Tila listname="Authorisation Status" id="5" value="Myyntilupa myönnetty"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
      <Laakevalmiste id="REL6"><Kauppanimi></Kauppanimi><HUM>1</HUM>
        <Myyntilupa><Tila listname="Authorisation Status" id="5" value="Myyntilupa myönnetty"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
      <Laakevalmiste id="REL7"><Kauppanimi>No packages</Kauppanimi><HUM>1</HUM>
        <Myyntilupa><Tila listname="Authorisation Status" id="5" value="Myyntilupa myönnetty"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
      <Laakeaine id="RES1"><VaikuttavaAine><Aine listname="Substance" id="1" value="Ibuprofen"/></VaikuttavaAine></Laakeaine>
      <Laakeaine id="RES2"><VaikuttavaAine><Aine listname="Substance" id="1" value="Ibuprofen"/></VaikuttavaAine><VaikuttavaAine><Aine listname="Substance" id="2" value="Ascorbic acid"/></VaikuttavaAine></Laakeaine>
    </Perusrekisteri>`;
    expect(parseFimea(xml)).toEqual([
      { brand: "Burana", ingredient: "Ibuprofen", country: "Finland", holder: "Orion Corporation", strength: "400 mg", form: "tabletti, kalvopäällysteinen", status: "Authorised, marketed" },
      { brand: "Burana-C", ingredient: "Ibuprofen + Ascorbic acid", country: "Finland", holder: "Orion & Co", strength: undefined, form: undefined, status: "Authorised" },
    ]);
  });

  it("Finland: loads the imported file, reloads a newer one, and does not wait after a failed load", async () => {
    const importDir = mkdtempSync(path.join(tmpdir(), "mf-imports-"));
    try {
      const file = path.join(importDir, FIMEA_FILE);
      const sample = (brand) => `<Perusrekisteri>
        <Pakkaus Laakevalmiste-ref="REL1"><Kaupanolo><Kaupan>1</Kaupan></Kaupanolo><Pakkaus_Laakeaine Laakeaine-ref="RES1"/></Pakkaus>
        <Laakevalmiste id="REL1"><Kauppanimi>${brand}</Kauppanimi><HUM>1</HUM>
          <Myyntilupa><Tila listname="Authorisation Status" id="5" value="x"/><RinnakkaisTuonti>0</RinnakkaisTuonti></Myyntilupa></Laakevalmiste>
        <Laakeaine id="RES1"><VaikuttavaAine><Aine listname="Substance" id="1" value="Ibuprofen"/></VaikuttavaAine></Laakeaine>
      </Perusrekisteri>`;
      const put = (text, atMs) => {
        writeFileSync(file, text);
        utimesSync(file, atMs / 1000, atMs / 1000);
      };
      expect(fimea.available({})).toBe(false);
      const now = fixedClock();
      const store = openStore(":memory:");
      const { sources, refreshDue } = createDatasetSources({ store, datasets: [fimea], now, importDir });
      await refreshDue();
      expect(sources[0].status()).toEqual({ state: "disabled", detail: fimea.unavailableDetail });

      put("<Perusrekisteri/>", now()); // a broken upload: no rows
      now.advance(60e3);
      await refreshDue();
      expect(sources[0].status().state).toBe("error");

      now.advance(60e3);
      put(sample("Burana"), now()); // fixed at once, well inside the hour of back-off
      await refreshDue();
      expect((await sources[0].search("ibuprofen")).results.map((r) => r.brandName)).toEqual(["Burana"]);

      now.advance(60e3);
      await refreshDue(); // same file: not reloaded
      put(sample("Burana Forte"), now());
      now.advance(60e3);
      await refreshDue();
      expect((await sources[0].search("ibuprofen")).results.map((r) => r.brandName)).toEqual(["Burana Forte"]);
    } finally {
      rmSync(importDir, { recursive: true, force: true });
    }
  });

  it("curated lists keep the other name of the ingredient searchable", () => {
    const rows = curatedRows();
    expect(rows.find((r) => r.brand === "Doliprane")).toMatchObject({ ingredient: "paracetamol (acetaminophen)", country: "France" });
    expect(rows.find((r) => r.brand === "Combiflam")?.ingredient).toBe("ibuprofen + paracetamol");
  });

  it("knows every name of an ingredient, whichever one is typed", () => {
    // every name (hand-made first, then the FDA UNII official names)
    expect(withSynonyms("Acetaminophen").slice(0, 3)).toEqual(["acetaminophen", "paracetamol", "acetaminofen"]);
    expect(withSynonyms("acetaminofen")).toEqual(expect.arrayContaining(["acetaminofen", "paracetamol", "acetaminophen", "paracetamolum"]));
    expect(withSynonyms("salbutamol")).toEqual(expect.arrayContaining(["salbutamol", "albuterol"]));
    // the names a search is sent with: none that an earlier one already finds
    expect(searchNames("Acetaminophen")).toEqual(["acetaminophen", "paracetamol", "acetaminofen"]);
    expect(searchNames("salbutamol")).toEqual(["salbutamol", "albuterol"]);
    expect(searchNames("ibuprofen")).toEqual(["ibuprofen"]);
  });
});

describe("SQLite store", () => {
  const rows = [
    { brand: "Advil", ingredient: "Ibuprofène", country: "France", strength: "200 mg" },
    { brand: "ADVIL", ingredient: "Ibuprofène", country: "France", strength: "400 mg" },
    { brand: "Antarène Codéine", ingredient: "Ibuprofène + Codéine", country: "France" },
    { brand: "Doliprane", ingredient: "Paracétamol", country: "France" },
  ];

  it("splits ingredient names into searchable words", () => {
    expect(ingredientWords("IBUPROFÈNE LYSINE + Codéine (base)")).toEqual(["ibuprofene", "lysine", "codeine", "base"]);
  });

  it("finds brands by every stem, one entry per brand with its strengths", () => {
    const store = openStore(":memory:");
    store.replace("bdpm", rows, 1000);
    expect(store.search("bdpm", stems("ibuprofen"))).toEqual({
      total: 2,
      results: [
        { brandName: "Advil", activeIngredient: "Ibuprofène", country: "France", manufacturer: undefined, strength: "200 mg, 400 mg", dosageForm: undefined, status: undefined, url: undefined },
        expect.objectContaining({ brandName: "Antarène Codéine" }),
      ],
    });
    expect(store.search("bdpm", stems("ibuprofen codeine")).results.map((r) => r.brandName)).toEqual(["Antarène Codéine"]);
    // combinations come after single-ingredient products even when their name sorts first
    store.replace("x", [{ brand: "Actisinu", ingredient: "Ibuprofene + Pseudoefedrina", country: "Italy" }, { brand: "Brufen", ingredient: "Ibuprofene", country: "Italy" }], 1);
    expect(store.search("x", stems("ibuprofen")).results.map((r) => r.brandName)).toEqual(["Brufen", "Actisinu"]);
    expect(store.search("bdpm", stems("xyzfoo"))).toEqual({ total: 0, results: [] });
    expect(store.search("other", stems("ibuprofen")).total).toBe(0);
    expect(store.info("bdpm")).toEqual({ loaded_at: 1000, rows: 4, error: null, attempted_at: 1000, format: null });
  });

  it("matches a one- or two-character word whole, and punctuation in the term is ignored", () => {
    const store = openStore(":memory:");
    store.replace("v", [
      { brand: "Vigantol", ingredient: "Vitamin D3", country: "Germany" },
      { brand: "Dekristol", ingredient: "Vitamin D", country: "Germany" },
      { brand: "Neurobion", ingredient: "Vitamin B12 + Vitamin B6 + Dexpanthenol", country: "Germany" },
      { brand: "Jarsin", ingredient: "Hypericum perforatum (St. John's wort)", country: "Germany" },
    ], 1);
    const brands = (term) => store.search("v", stems(term)).results.map((r) => r.brandName);
    expect(brands("vitamin d")).toEqual(["Dekristol"]);
    expect(brands("vitamin d3")).toEqual(["Vigantol"]);
    expect(brands("vitamin b12")).toEqual(["Neurobion"]);
    expect(brands("St. John's wort")).toEqual(["Jarsin"]);
  });

  it("replaces a source atomically and keeps the error of a failed refresh", () => {
    const store = openStore(":memory:");
    store.replace("bdpm", rows, 1000);
    store.replace("bdpm", rows.slice(3), 2000);
    expect(store.search("bdpm", stems("ibuprofen")).total).toBe(0);
    store.markError("bdpm", "HTTP 503", 3000);
    expect(store.info("bdpm")).toEqual({ loaded_at: 2000, rows: 1, error: "HTTP 503", attempted_at: 3000, format: null });
  });
});

describe("dataset loading", () => {
  const dataset = (id, load, refreshMs = 24 * 3600e3) => ({ id, name: id, kind: "official", coverage: "", homepage: "", refreshMs, load });

  it("loads each dataset once, reports status, retries failures after an hour", async () => {
    const now = fixedClock();
    const store = openStore(":memory:");
    let fail = true;
    const good = dataset("good", async () => [{ brand: "Advil", ingredient: "Ibuprofen", country: "France" }]);
    const bad = dataset("bad", async () => {
      if (fail) throw new Error("HTTP 503");
      return [{ brand: "Nurofen", ingredient: "Ibuprofen", country: "Italy" }];
    });
    const { sources, refreshDue } = createDatasetSources({ store, datasets: [good, bad], now });
    await expect(sources[0].search("ibuprofen")).rejects.toThrow("data not loaded yet");
    await refreshDue();
    expect(sources[0].status()).toMatchObject({ state: "ready", rows: 1 });
    expect(sources[1].status()).toEqual({ state: "error", detail: "HTTP 503" });
    expect(await sources[0].search("ibuprofen")).toEqual({ total: 1, results: [expect.objectContaining({ brandName: "Advil" })] });

    fail = false;
    now.advance(30 * 60e3);
    await refreshDue();
    expect(sources[1].status().state).toBe("error");
    now.advance(31 * 60e3);
    await refreshDue();
    expect(sources[1].status()).toMatchObject({ state: "ready", rows: 1 });
  });

  it("says when a file imported by hand is getting old", async () => {
    const now = fixedClock();
    const day = 24 * 3600e3;
    let fileTime = now();
    const imported = { ...dataset("imp", async () => [{ brand: "Burana", ingredient: "Ibuprofen", country: "Finland" }], 30 * day), modifiedAt: () => fileTime, staleAfterMs: 45 * day };
    const { sources, refreshDue } = createDatasetSources({ store: openStore(":memory:"), datasets: [imported], now });
    await refreshDue();
    expect(sources[0].status().detail).toBeUndefined();
    fileTime = now() - 50 * day;
    expect(sources[0].status().detail).toBe("imported file is 50 days old; replace it (docs/DEPLOY.md)");
  });

  it("keeps a dataset that needs a key off until the key is set, and gives the key to its loader", async () => {
    const keyed = { ...dataset("keyed", async (_fetch, ctx) => [{ brand: `B-${ctx.env.SOME_API_KEY}`, ingredient: "Ibuprofen", country: "United Kingdom" }]), requires: "SOME_API_KEY" };
    const off = createDatasetSources({ store: openStore(":memory:"), datasets: [keyed], now: fixedClock() });
    await off.refreshDue();
    expect(off.sources[0].enabled()).toBe(false);
    expect(off.sources[0].status()).toEqual({ state: "disabled", detail: "set SOME_API_KEY to enable" });
    const on = createDatasetSources({ store: openStore(":memory:"), datasets: [keyed], now: fixedClock(), env: { SOME_API_KEY: "k1" } });
    await on.refreshDue();
    expect((await on.sources[0].search("ibuprofen")).results[0].brandName).toBe("B-k1");
  });

  it("leaves an unavailable dataset off, then loads it, and reloads it when its file is newer", async () => {
    const now = fixedClock();
    const store = openStore(":memory:");
    let present = false;
    let fileTime = 0;
    let loads = 0;
    const imported = {
      ...dataset("imported", async (_fetch, ctx) => {
        loads += 1;
        expect(ctx).toEqual({ importDir: "/data/imports", env: {} });
        return [{ brand: "Burana", ingredient: "Ibuprofen", country: "Finland" }];
      }, 30 * 24 * 3600e3),
      available: () => present,
      unavailableDetail: "no file imported yet",
      modifiedAt: () => fileTime,
    };
    const { sources, refreshDue } = createDatasetSources({ store, datasets: [imported], now, importDir: "/data/imports" });
    await refreshDue();
    expect(loads).toBe(0);
    expect(sources[0].enabled()).toBe(false);
    expect(sources[0].status()).toEqual({ state: "disabled", detail: "no file imported yet" });

    present = true;
    fileTime = now();
    now.advance(60e3);
    await refreshDue();
    await refreshDue();
    expect(loads).toBe(1);
    expect(sources[0].status()).toMatchObject({ state: "ready", rows: 1 });

    now.advance(60e3);
    fileTime = now();
    now.advance(60e3);
    await refreshDue();
    expect(loads).toBe(2);
  });

  it("reloads, once, a dataset saved with an older data format, serving the old rows meanwhile", async () => {
    const now = fixedClock();
    const store = openStore(":memory:");
    store.replace("d", [{ brand: "Old", ingredient: "Ibuprofen", country: "France" }], now(), DATA_FORMAT - 1);
    let loads = 0;
    const d = dataset("d", async () => {
      loads += 1;
      return [{ brand: "New", ingredient: "Ibuprofen", country: "France" }];
    });
    const { sources, refreshDue } = createDatasetSources({ store, datasets: [d], now });
    expect((await sources[0].search("ibuprofen")).results[0].brandName).toBe("Old");
    await refreshDue();
    await refreshDue();
    expect(loads).toBe(1);
    expect(store.info("d").format).toBe(DATA_FORMAT);
    expect((await sources[0].search("ibuprofen")).results[0].brandName).toBe("New");
  });

  it("rejects an empty download instead of wiping good data", async () => {
    const now = fixedClock();
    const store = openStore(":memory:");
    let rows = [{ brand: "Advil", ingredient: "Ibuprofen", country: "France" }];
    const d = dataset("d", async () => rows, 1000);
    const { sources, refreshDue } = createDatasetSources({ store, datasets: [d], now });
    await refreshDue();
    rows = [];
    now.advance(2000);
    await refreshDue();
    expect(sources[0].status()).toMatchObject({ state: "ready", rows: 1, detail: "last refresh failed: the download contained no usable rows" });
  });

  it("searches the other international name too", async () => {
    const store = openStore(":memory:");
    const d = dataset("d", async () => [{ brand: "Doliprane", ingredient: "Paracétamol", country: "France" }]);
    const { sources, refreshDue } = createDatasetSources({ store, datasets: [d], now: fixedClock() });
    await refreshDue();
    expect((await sources[0].search("acetaminophen")).results.map((r) => r.brandName)).toEqual(["Doliprane"]);
  });
});

describe("brand-name search", () => {
  const load = async (byDataset) => {
    const store = openStore(":memory:");
    const datasets = Object.entries(byDataset).map(([id, rows]) => ({ id, name: id, kind: "official", refreshMs: 24 * 3600e3, load: async () => rows }));
    const ds = createDatasetSources({ store, datasets, now: fixedClock() });
    await ds.refreshDue();
    return { store, ...ds };
  };

  it("indexes brand names and finds a brand and the products starting with it", async () => {
    const { store } = await load({ bdpm: [
      { brand: "Nurofen", ingredient: "Ibuprofène", country: "France" },
      { brand: "Nurofen Junior", ingredient: "Ibuprofène", country: "France" },
      { brand: "Nurofenix", ingredient: "Other", country: "France" },
    ] });
    expect(store.findBrands("bdpm", "nurofen").map((r) => r.brand)).toEqual(["Nurofen", "Nurofen Junior"]);
    expect(store.findBrands("bdpm", "")).toEqual([]);
    expect(store.hasIngredientWords("bdpm", stems("ibuprofen"))).toBe(true);
    expect(store.hasIngredientWords("bdpm", stems("nurofen"))).toBe(false);
  });

  it("turns a brand into its ingredient, preferring single-ingredient products and English names", async () => {
    const { resolveBrand } = await load({
      bdpm: [{ brand: "Nurofen", ingredient: "Ibuprofène", country: "France" }, { brand: "Nurofen Rhume", ingredient: "Ibuprofène + Pseudoéphédrine", country: "France" }],
      "ema-article57": [{ brand: "Nurofen", ingredient: "Ibuprofen Lysine", country: "Austria" }],
    });
    expect(resolveBrand("Nurofen")).toEqual({ name: "Nurofen", ingredient: "Ibuprofen Lysine", searchFor: "ibuprofen", others: [] });
    // an ingredient (or another name of one) is searched as it is
    expect(resolveBrand("ibuprofen")).toBeNull();
    expect(resolveBrand("unknownbrand")).toBeNull();
    expect(resolveBrand("nu")).toBeNull();
  });

  it("names the brand as the register writes it when only longer names match", async () => {
    const { resolveBrand } = await load({ a: [{ brand: "Dolormin Extra", ingredient: "Ibuprofen", country: "Germany" }] });
    expect(resolveBrand("dolormin")).toMatchObject({ name: "Dolormin", ingredient: "Ibuprofen" });
  });

  it("warns when the same brand name stands for a different ingredient elsewhere", async () => {
    const { resolveBrand } = await load({
      a: [{ brand: "Flomax", ingredient: "Tamsulosin", country: "United States" }, { brand: "Flomax", ingredient: "Tamsulosin", country: "Canada" }],
      b: [{ brand: "Flomax", ingredient: "Morniflumate", country: "Italy" }],
    });
    expect(resolveBrand("flomax")).toMatchObject({ ingredient: "Tamsulosin", others: [{ ingredient: "Morniflumate", countries: ["Italy"] }] });
  });

  it("a source covering several countries keeps each country's brands apart and filters by the chosen one", async () => {
    const store = openStore(":memory:");
    const rows = [
      ...Array.from({ length: 25 }, (_, i) => ({ brand: `A${String(i).padStart(2, "0")}`, ingredient: "Ibuprofen", country: "Austria" })),
      { brand: "Nurofen", ingredient: "Ibuprofen", country: "Austria" },
      { brand: "Nurofen", ingredient: "Ibuprofen", country: "Germany" },
      { brand: "Dolormin", ingredient: "Ibuprofen", country: "Germany" },
    ];
    const d = { id: "multi", name: "multi", kind: "official", countries: ["Austria", "Germany"], refreshMs: 24 * 3600e3, load: async () => rows };
    const { sources, refreshDue } = createDatasetSources({ store, datasets: [d], now: fixedClock() });
    await refreshDue();
    expect(sources[0].maxResults).toBe(PER_COUNTRY * 2);
    const germany = await sources[0].search("ibuprofen", { country: "Germany" });
    expect(germany.results.map((r) => [r.brandName, r.country])).toEqual([["Dolormin", "Germany"], ["Nurofen", "Germany"]]);
    const all = await sources[0].search("ibuprofen", {});
    expect(all.results.filter((r) => r.country === "Austria")).toHaveLength(PER_COUNTRY);
    expect(all.results.filter((r) => r.country === "Germany").map((r) => r.brandName)).toEqual(["Dolormin", "Nurofen"]);
    expect(all.total).toBe(28);
  });

  it("does not warn when the other name is another name of the same ingredient", async () => {
    const { resolveBrand } = await load({
      a: [{ brand: "Panadol", ingredient: "Paracetamol", country: "Portugal" }, { brand: "Panadol", ingredient: "Paracetamol", country: "Malta" }],
      b: [{ brand: "Panadol", ingredient: "ACETAMINOPHEN", country: "United States" }],
    });
    expect(resolveBrand("panadol")).toMatchObject({ ingredient: "Paracetamol", others: [] });
  });

  it("does not search a brand of three or more substances by its ingredients", async () => {
    const { resolveBrand } = await load({ a: [{ brand: "Accusol", ingredient: "Sodium Chloride + Calcium Chloride + Magnesium Chloride", country: "Germany" }] });
    expect(resolveBrand("accusol")).toBeNull();
  });

  it("tells spellings of one substance from different substances", () => {
    const same = [
      ["Metyrapone", "Metirapone"], ["Ciclosporin", "Ciklosporin"], ["Voriconazole", "Vorikonazol"],
      ["Flupentixol Hydrochloride", "Dichlorhydrate De Flupentixol"], ["Clobetasol Propionate", "Propionate De Clobétasol"],
      ["Cholic Acid", "Acide Cholique"], ["Cholic Acid", "Acido Colico"], ["Filgrastim", "Recombinant Filgrastim"],
      ["Oxymetazoline Hydrochloride", "Oximetazolina Clorhidrato"], ["Fluorid", "Natriumfluoride"], ["Fluorid", "Sodium Fluoride"],
      ["Alendronic Acid", "Sodium Alendronate Trihydrate"], ["Paracetamol", "ACETAMINOPHEN"], ["Ibuprofen", "ibuprofène"],
      ["Fusidic Acid", "Sodium Fusidate"], ["Anhydrous Lidocaine Hydrochloride", "LIGNOCAINE HCl ANHYDROUS"], ["Quizartinib", "Kizartinib"],
      ["Haloperidol", "Aloperidolo"],
    ];
    for (const [a, b] of same) expect(sameIngredient(a, b), `${a} = ${b}`).toBe(true);
    const different = [
      ["Pseudoephedrine Hydrochloride", "Xylometazoline hydrochloride"], ["Sodium Cromoglicate", "Azelastina Cloridrato"],
      ["Sodium Chloride", "Potassium Chloride"], ["Vitamin D3", "Vitamin B12"], ["Chlorhexidine", "Chlorphenamine"], ["Tamsulosin", "Morniflumate"],
      ["Ibuprofene Sale Di Lisina", "Naproxene Sodico"], ["Bisacodyl", "Sodium Picosulfate Monohydrate"], ["Dinoprostone", "Alprostadil"],
    ];
    for (const [a, b] of different) expect(sameIngredient(a, b), `${a} != ${b}`).toBe(false);
  });

  it("keeps only the substance part of a resolved ingredient", () => {
    expect(coreIngredient("Dexamethasone Sodium Phosphate")).toBe("dexamethasone");
    expect(coreIngredient("Acetylsalicylic Acid")).toBe("acetylsalicylic acid");
    expect(coreIngredient("Pseudoephedrine Hydrochloride + Ibuprofen")).toBe("pseudoephedrine + ibuprofen");
    expect(coreIngredient("Sodium Chloride")).toBe("sodium chloride");
    expect(coreIngredient("Magnesium Hydroxide")).toBe("magnesium hydroxide");
    expect(coreIngredient("Diclofenac Diethylamine")).toBe("diclofenac");
    expect(coreIngredient("Cetirizine Dihydrochloride")).toBe("cetirizine");
    // salts of a metal keep their name (else "magnesium" would find every magnesium product)
    expect(coreIngredient("Magnesium Sulfate")).toBe("magnesium sulfate");
    expect(coreIngredient("Sodium Phosphate")).toBe("sodium phosphate");
    expect(coreIngredient("Ferrous Sulfate Dihydrate")).toBe("ferrous sulfate");
  });
});

describe("zip downloads", () => {
  const binary = (buf) => new Response(buf, { status: 200, headers: { "content-type": "application/zip" } });

  it("Canada: reads the five files of the extract", async () => {
    const zip = makeZip({
      "drug.txt": '"7","","Human","1","TYLENOL"',
      "ingred.txt": '"7","1","ACETAMINOPHEN","I","500","MG"',
      "comp.txt": '"7","","1","KENVUE","DIN_OWNER"',
      "form.txt": '"7","1","TABLET"',
      "status.txt": '"7","Y","MARKETED"',
      "route.txt": "not read",
    });
    const fetch = stubFetch([[DPD_URL, () => binary(zip)]]);
    expect((await dpd.load(fetch)).map((r) => [r.brand, r.ingredient])).toEqual([["Tylenol", "Acetaminophen"]]);
    const broken = stubFetch([[DPD_URL, () => binary(makeZip({ "drug.txt": "" }))]]);
    await expect(dpd.load(broken)).rejects.toThrow("ingred.txt missing");
  });

  it("Czech Republic: follows the catalogue link and decodes windows-1250", async () => {
    // the few windows-1250 bytes these rows need (é, č); the rest is ASCII
    const cp1250 = (s) => Buffer.from([...s].map((c) => ({ "é": 0xe9, "č": 0xe8 })[c] ?? c.charCodeAt(0)));
    const zipUrl = "https://opendata.sukl.gov.cz/soubory/SOD20260925/DLP20260925.zip";
    const zip = makeZip({
      "dlp_lecivepripravky.csv": cp1250("KOD_SUKL;NAZEV;SILA;FORMA;DRZ;ZEMDRZ;REG\r\n1;IBUMAX;200MG;TBL;LZ;CZ;R\r\n"),
      "dlp_slozeni.csv": "KOD_SUKL;KOD_LATKY;SQ;S\r\n1;10;1;L\r\n",
      "dlp_latky.csv": "KOD_LATKY;ZDROJ;NAZEV_INN;NAZEV_EN\r\n10;;IBUPROFENUM;IBUPROFEN\r\n",
      "dlp_organizace.csv": cp1250("ZKR_ORG;ZEM;NAZEV\r\nLZ;CZ;Léčiva Zentiva, Praha\r\n"),
      "dlp_formy.csv": "FORMA;NAZEV;NAZEV_EN\r\nTBL;Tableta;Tablet\r\n",
    });
    const fetch = stubFetch([
      [SUKL_PAGE, () => new Response(`<a href="${zipUrl}">DLP</a>`, { headers: { "content-type": "text/html" } })],
      [zipUrl, () => binary(zip)],
    ]);
    expect(await sukl.load(fetch)).toEqual([
      { brand: "Ibumax", ingredient: "Ibuprofen", country: "Czech Republic", holder: "Léčiva Zentiva", strength: "200 mg", form: "Tablet", status: "Registered" },
    ]);
    const noLink = stubFetch([[SUKL_PAGE, () => new Response("<p>maintenance</p>")]]);
    await expect(sukl.load(noLink)).rejects.toThrow("link to the current DLP zip not found");
  });

  it("Lithuania: tries again once after a 502 from the portal", async () => {
    let calls = 0;
    const csv = "vid,preparato_pav,atc_kodas,veikl_angl_pavad,stadija,pak_tiekimo_busena\n1,Nurofen,M01AE01,Ibuprofen,Registruotas,Tiekiama\n";
    const fetch = stubFetch([[VVKT_URL, () => (++calls === 1 ? new Response("Bad Gateway", { status: 502 }) : new Response(csv))]]);
    expect((await vvkt.load(fetch)).map((r) => r.brand)).toEqual(["Nurofen"]);
    expect(calls).toBe(2);
  });

  it("Singapore: asks for a fresh signed link, then reads the CSV", async () => {
    const csvUrl = "https://s3.example/sg.csv?signed=1";
    const fetch = stubFetch([
      [HSA_POLL_URL, () => new Response(JSON.stringify({ code: 0, data: { url: csvUrl } }), { headers: { "content-type": "application/json" } })],
      [csvUrl, () => new Response("Productname,Activeingredients,Strength,Dosageform,Licenseholder\nPANADOL TABLET 500 mg,PARACETAMOL,500 mg,TABLET,GSK\n")],
    ]);
    expect((await hsa.load(fetch)).map((r) => [r.brand, r.ingredient])).toEqual([["Panadol", "Paracetamol"]]);
  });

  it("New Zealand: picks the newest schedule listed in the archive", async () => {
    const fetch = stubFetch([
      [PHARMAC_INDEX + "Schedule_2026-11.xml", () => new Response("<Chemical><Name>Ibuprofen</Name><Formulation><Name>Tab 200 mg</Name><Brand><Name>Relieve</Name></Brand></Formulation></Chemical>")],
      [PHARMAC_INDEX, () => new Response('<a href="Schedule_2026-09.xml">x</a><a href="Schedule_2026-11.xml">y</a><a href="Schedule_2026-10.xml">z</a>')],
    ]);
    expect((await pharmac.load(fetch)).map((r) => r.brand)).toEqual(["Relieve"]);
    expect(fetch.calls.map((c) => c.url.split("/").at(-1))).toEqual(["", "Schedule_2026-11.xml"]);
  });
});
