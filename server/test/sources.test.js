import { describe, it, expect } from "vitest";
import { createCimaSource } from "../sources/cima.js";
import { createHealthCanadaSource } from "../sources/healthCanada.js";
import { stubFetch, jsonResponse } from "./helpers.js";

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
    expect(fetch.calls).toHaveLength(1);
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

describe("other international names", () => {
  it("CIMA also searches paracetamol when asked for acetaminophen", async () => {
    const fetch = stubFetch([["cima.aemps.es", () => jsonResponse({ resultados: [] })]]);
    await createCimaSource({ fetch }).search("acetaminophen");
    expect(fetch.calls.map((c) => new URL(c.url).searchParams.get("practiv1"))).toEqual(["acetaminop", "paraceta"]);
  });
});
