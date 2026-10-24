import { describe, it, expect } from "vitest";
import { createCimaSource } from "../sources/cima.js";
import { createHealthCanadaSource, healthCanadaMode } from "../sources/healthCanada.js";
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
    const { total, results: rows } = await createCimaSource({ fetch }).search("ibuprofen");
    expect(total).toBe(1);
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

  it("reports an outage on Health Canada's side as not available", async () => {
    const fetch = stubFetch([["/activeingredient/", () => jsonResponse("Service Unavailable", { status: 503, type: "text/html" })]]);
    const hc = createHealthCanadaSource({ fetch });
    const err = await hc.search("ibuprofen").catch((e) => e);
    expect(err.unavailable).toBe(true);
    expect(err.message).toBe("Health Canada's API is not answering (HTTP 503 from health-products.canada.ca)");
    expect(hc.status()).toEqual({ state: "unavailable", detail: err.message });
  });

  it("treats a timeout as an outage and a 4xx answer as an error", async () => {
    const timeout = stubFetch([["/activeingredient/", () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"))]]);
    expect((await createHealthCanadaSource({ fetch: timeout }).search("x").catch((e) => e)).unavailable).toBe(true);
    const bad = stubFetch([["/activeingredient/", () => jsonResponse("bad", { status: 400, type: "text/html" })]]);
    const hc = createHealthCanadaSource({ fetch: bad });
    const err = await hc.search("x").catch((e) => e);
    expect(err.unavailable).toBeUndefined();
    expect(hc.status()).toEqual({ state: "error", detail: "HTTP 400 from health-products.canada.ca" });
  });
});

describe("HEALTH_CANADA setting", () => {
  it("uses the data extract by default and accepts live, both and off", () => {
    expect(healthCanadaMode(undefined)).toEqual({ dataset: true, live: false });
    expect(healthCanadaMode(" Live ")).toEqual({ dataset: false, live: true });
    expect(healthCanadaMode("both")).toEqual({ dataset: true, live: true });
    expect(healthCanadaMode("off")).toEqual({ dataset: false, live: false });
  });

  it("falls back to the extract on an unknown value and says so", () => {
    const lines = [];
    expect(healthCanadaMode("yes", (m) => lines.push(m))).toEqual({ dataset: true, live: false });
    expect(lines).toEqual(['HEALTH_CANADA="yes" is not one of dataset, live, both, off; using dataset']);
  });
});

describe("other international names", () => {
  it("CIMA also searches paracetamol when asked for acetaminophen", async () => {
    const fetch = stubFetch([["cima.aemps.es", () => jsonResponse({ resultados: [] })]]);
    await createCimaSource({ fetch }).search("acetaminophen");
    expect(fetch.calls.map((c) => new URL(c.url).searchParams.get("practiv1"))).toEqual(["acetaminop", "paraceta", "acetamino"]);
  });

  it("CIMA keeps the names that answered when one call fails, and reports CIMA's total", async () => {
    const fetch = stubFetch([
      ["practiv1=paraceta", () => jsonResponse({ totalFilas: 120, resultados: [{ nregistro: "1", nombre: "GELOCATIL 1 G COMPRIMIDOS" }] })],
      ["cima.aemps.es", () => jsonResponse("down", { status: 503, type: "text/html" })],
    ]);
    const out = await createCimaSource({ fetch }).search("acetaminophen");
    expect(out.total).toBe(120);
    expect(out.results.map((r) => r.brandName)).toEqual(["Gelocatil"]);
  });

  it("CIMA fails only when every call fails", async () => {
    const fetch = stubFetch([["cima.aemps.es", () => jsonResponse("down", { status: 503, type: "text/html" })]]);
    await expect(createCimaSource({ fetch }).search("ibuprofen")).rejects.toThrow("HTTP 503 from cima.aemps.es");
  });
});
