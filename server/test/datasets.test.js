import { describe, it, expect } from "vitest";
import { parseEma } from "../datasets/ema.js";
import { parseBdpm } from "../datasets/bdpm.js";
import { parseAifa } from "../datasets/aifa.js";
import { parseUrpl } from "../datasets/urpl.js";
import { parseCbg } from "../datasets/cbg.js";
import { parseHpra } from "../datasets/hpra.js";
import { parseSwissmedicRows } from "../datasets/swissmedic.js";
import { curatedRows } from "../datasets/curated.js";
import { withSynonyms } from "../datasets/common.js";
import { openStore, ingredientWords } from "../db/store.js";
import { createDatasetSources } from "../datasets/index.js";
import { stems } from "../lib/text.js";
import { fixedClock } from "./helpers.js";

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

  it("curated lists keep the other name of the ingredient searchable", () => {
    const rows = curatedRows();
    expect(rows.find((r) => r.brand === "Doliprane")).toMatchObject({ ingredient: "paracetamol (acetaminophen)", country: "France" });
    expect(rows.find((r) => r.brand === "Combiflam")?.ingredient).toBe("ibuprofen + paracetamol");
  });

  it("knows INN/US name pairs both ways", () => {
    expect(withSynonyms("Acetaminophen")).toEqual(["acetaminophen", "paracetamol"]);
    expect(withSynonyms("salbutamol")).toEqual(["salbutamol", "albuterol"]);
    expect(withSynonyms("ibuprofen")).toEqual(["ibuprofen"]);
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
    expect(store.info("bdpm")).toEqual({ loaded_at: 1000, rows: 4, error: null, attempted_at: 1000 });
  });

  it("replaces a source atomically and keeps the error of a failed refresh", () => {
    const store = openStore(":memory:");
    store.replace("bdpm", rows, 1000);
    store.replace("bdpm", rows.slice(3), 2000);
    expect(store.search("bdpm", stems("ibuprofen")).total).toBe(0);
    store.markError("bdpm", "HTTP 503", 3000);
    expect(store.info("bdpm")).toEqual({ loaded_at: 2000, rows: 1, error: "HTTP 503", attempted_at: 3000 });
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
