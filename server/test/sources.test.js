import { describe, it, expect } from "vitest";
import { createEmaSource, indexEma, EMA_URL } from "../sources/ema.js";
import { createBdpmSource, indexBdpm, BDPM_SPEC_URL, BDPM_COMPO_URL } from "../sources/bdpm.js";
import { createCimaSource } from "../sources/cima.js";
import { createHealthCanadaSource } from "../sources/healthCanada.js";
import { stubFetch, jsonResponse, fixedClock } from "./helpers.js";

const EMA_JSON = {
  meta: { total_records: 4 },
  data: [
    { category: "Human", name_of_medicine: "Pedea", medicine_status: "Authorised", active_substance: "Ibuprofen", international_non_proprietary_name_common_name: "ibuprofen", marketing_authorisation_developer_applicant_holder: "Recordati Rare Diseases", medicine_url: "https://www.ema.europa.eu/en/medicines/human/EPAR/pedea" },
    { category: "Human", name_of_medicine: "Old Ibuprofen Combo", medicine_status: "Withdrawn", active_substance: "Ibuprofen", international_non_proprietary_name_common_name: "" },
    { category: "Veterinary", name_of_medicine: "Vet Product", medicine_status: "Authorised", active_substance: "Ibuprofen" },
    { category: "Human", name_of_medicine: "Voriconazole Hikma", medicine_status: "Authorised", active_substance: "voriconazole" },
  ],
};

describe("EMA source", () => {
  it("indexes human medicines only", () => {
    expect(indexEma(EMA_JSON).map((r) => r.name)).toEqual(["Pedea", "Old Ibuprofen Combo", "Voriconazole Hikma"]);
    expect(indexEma({})).toEqual([]);
  });

  it("returns authorised medicines with the ingredient, with links", async () => {
    const fetch = stubFetch([[EMA_URL, () => jsonResponse(EMA_JSON)]]);
    const ema = createEmaSource({ fetch, now: fixedClock() });
    const rows = await ema.search("ibuprofen");
    expect(rows).toEqual([
      {
        brandName: "Pedea",
        activeIngredient: "Ibuprofen",
        country: "European Union",
        manufacturer: "Recordati Rare Diseases",
        status: "Authorised",
        url: "https://www.ema.europa.eu/en/medicines/human/EPAR/pedea",
      },
    ]);
    expect(ema.status().state).toBe("ready");
    // a second search reuses the downloaded data
    await ema.search("voriconazole");
    expect(fetch.calls).toHaveLength(1);
  });

  it("reports an error when the download fails", async () => {
    const fetch = stubFetch([[EMA_URL, () => jsonResponse("down", { status: 503, type: "text/html" })]]);
    const ema = createEmaSource({ fetch, now: fixedClock() });
    await expect(ema.search("ibuprofen")).rejects.toThrow(/still loading/);
    expect(ema.status()).toMatchObject({ state: "error", detail: expect.stringContaining("503") });
  });
});

const SPEC = [
  "60000001\tADVIL 200 mg, comprimé enrobé\tcomprimé enrobé\torale\tAutorisation active\tProcédure nationale\tCommercialisée\t01/01/2000\t\t\t PFIZER HEALTH\tNon",
  "60000002\tIBUPROFENE BIOGARAN 400 mg, comprimé\tcomprimé\torale\tAutorisation active\tProcédure nationale\tNon commercialisée\t01/01/2000\t\t\t BIOGARAN\tNon",
  "60000003\tAMOXICILLINE KRKA 1 g, comprimé\tcomprimé\torale\tAutorisation active\tProcédure nationale\tCommercialisée\t01/01/2000\t\t\t KRKA\tNon",
].join("\n");
const COMPO = [
  "60000001\tcomprimé\t01234\tIBUPROFÈNE\t200 mg\tun comprimé\tSA\t1",
  "60000002\tcomprimé\t01234\tIBUPROFÈNE\t400 mg\tun comprimé\tSA\t1",
  "60000003\tcomprimé\t05678\tAMOXICILLINE TRIHYDRATÉE\t1 g\tun comprimé\tSA\t1",
  "60000003\tcomprimé\t05679\tAMOXICILLINE\t1 g\tun comprimé\tFT\t1",
].join("\r\n");

describe("France BDPM source", () => {
  it("keeps marketed medicines with an active authorisation", () => {
    const { products, substances } = indexBdpm(SPEC, COMPO);
    expect([...products.keys()]).toEqual(["60000001", "60000003"]);
    expect(substances.map((s) => s.name)).toEqual(["IBUPROFÈNE", "AMOXICILLINE TRIHYDRATÉE", "AMOXICILLINE"]);
  });

  it("decodes ISO-8859-1 files and finds products by an English name", async () => {
    const latin1 = (s) => new Response(Buffer.from(s, "latin1"), { headers: { "content-type": "text/plain" } });
    const fetch = stubFetch([
      [BDPM_SPEC_URL, () => latin1(SPEC)],
      [BDPM_COMPO_URL, () => latin1(COMPO)],
    ]);
    const bdpm = createBdpmSource({ fetch, now: fixedClock() });
    expect(await bdpm.search("amoxicillin")).toEqual([
      {
        brandName: "Amoxicilline Krka",
        activeIngredient: "Amoxicilline Trihydratée",
        country: "France",
        manufacturer: "Krka",
        strength: "1 g",
        dosageForm: "comprimé",
        url: "https://base-donnees-publique.medicaments.gouv.fr/medicament/60000003/extrait",
      },
    ]);
    expect((await bdpm.search("ibuprofen")).map((r) => r.brandName)).toEqual(["Advil"]);
  });
});

describe("Spain CIMA source", () => {
  it("queries marketed medicines by the ingredient stem and maps them", async () => {
    const fetch = stubFetch([
      [
        "cima.aemps.es",
        () =>
          jsonResponse({
            totalFilas: 1,
            resultados: [
              {
                nregistro: "89654",
                nombre: "ANTIDOL DUAL 500 MG/200 MG COMPRIMIDOS",
                labtitular: "Laboratorios Cinfa S.A.",
                receta: false,
                dosis: "500 mg/200 mg",
                vtm: { nombre: "paracetamol + ibuprofeno" },
                formaFarmaceutica: { nombre: "COMPRIMIDO RECUBIERTO" },
              },
            ],
          }),
      ],
    ]);
    const rows = await createCimaSource({ fetch }).search("ibuprofen");
    expect(fetch.calls[0].url).toBe("https://cima.aemps.es/cima/rest/medicamentos?practiv1=ibupro&comerc=1&pagina=1");
    expect(rows).toEqual([
      {
        brandName: "Antidol Dual",
        activeIngredient: "paracetamol + ibuprofeno",
        country: "Spain",
        manufacturer: "Laboratorios Cinfa S.A.",
        strength: "500 mg/200 mg",
        dosageForm: "Comprimido Recubierto",
        status: "Without prescription",
        url: "https://cima.aemps.es/cima/publico/detalle.html?nregistro=89654",
      },
    ]);
  });
});

describe("Health Canada source", () => {
  it("looks up products for each drug code", async () => {
    const fetch = stubFetch([
      ["/activeingredient/", () => jsonResponse([{ drug_code: 1 }, { drug_code: 2 }, { drug_code: 1 }])],
      ["id=1", () => jsonResponse([{ drug_code: 1, brand_name: "ADVIL", company_name: "HALEON CANADA ULC", class_name: "Human" }])],
      ["id=2", () => jsonResponse("down", { status: 500, type: "text/html" })],
    ]);
    const hc = createHealthCanadaSource({ fetch });
    expect(await hc.search("ibuprofen")).toEqual([
      {
        brandName: "Advil",
        activeIngredient: "ibuprofen",
        country: "Canada",
        manufacturer: "Haleon Canada Ulc",
        status: "Human",
        url: "https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=1",
      },
    ]);
    expect(hc.status().state).toBe("live");
  });

  it("reports the service error", async () => {
    const fetch = stubFetch([["/activeingredient/", () => jsonResponse("Service Unavailable", { status: 503, type: "text/html" })]]);
    const hc = createHealthCanadaSource({ fetch });
    await expect(hc.search("ibuprofen")).rejects.toThrow("HTTP 503");
    expect(hc.status()).toEqual({ state: "error", detail: "HTTP 503 from health-products.canada.ca" });
  });
});
