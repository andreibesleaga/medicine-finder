import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import Ajv from "ajv";
import draft06 from "ajv/dist/refs/json-schema-draft-06.json";
import { exportRows, sourceTerms, toXlsxFile } from "@/lib/export/exportResults";
import { fhirSubstances, sha1, toFhirR4, uuidV5, EXT } from "@/lib/export/fhir";
import { clearRxnormCache, rxcuis, RXNORM_SYSTEM, substances } from "@/lib/export/rxnorm";
import { readFirstSheet, unzip } from "../server/lib/xlsx.js";
import type { SearchOutcome } from "@/types/medicine";
import { jsonResponse, stubFetch } from "./helpers";

// HL7's official FHIR R4 JSON Schema (https://hl7.org/fhir/R4/fhir.schema.json.zip), stored compressed
const { id: schemaId, ...schemaBody } = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/fhir-r4.schema.json.gz", import.meta.url))).toString("utf8"));
// the R4 schema names itself with the draft-04 keyword "id"; Ajv 8 wants "$id" (content unchanged)
const schema = { ...schemaBody, $id: schemaId };
let validate: ReturnType<Ajv["compile"]>;
// compiling the 3.4 MB schema takes a few seconds, more while the other test files run
beforeAll(() => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  ajv.addMetaSchema(draft06);
  validate = ajv.compile(schema);
}, 60000);

const outcome: SearchOutcome = {
  term: "ibuprofen",
  country: "Germany",
  results: [
    { id: "1", brandName: "Dolormin", activeIngredient: "Ibuprofen", country: "Germany", manufacturer: "J&J <GmbH>", strength: "200 mg", dosageForm: "Tablet", status: "Authorised", sourceId: "ema-article57", sourceName: "EMA Article 57", kind: "official" },
    { id: "2", brandName: "Boxagrippal", activeIngredient: "Pseudoephedrine + Ibuprofen", country: "Germany", sourceId: "ema-article57", sourceName: "EMA Article 57", kind: "official", url: "https://example.org/record/2" },
    { id: "3", brandName: "Madeupin", activeIngredient: "ibuprofen", country: "Not stated", sourceId: "ai-x", sourceName: "AI suggestion: X", kind: "ai" },
    { id: "4", brandName: "Brufen", activeIngredient: "Ibuprofen", country: "Malta", sourceId: "malta-ma", sourceName: "Malta", kind: "official" },
    { id: "5", brandName: "Advil Col", activeIngredient: "Ibuprofeno", country: "Colombia", sourceId: "invima", sourceName: "INVIMA", kind: "official" },
  ],
  sources: [
    { id: "ema-article57", name: "EMA Article 57", kind: "official", state: "ok", count: 2, terms: "https://ema.example/legal", reuse: "Name EMA as the source in every copy" },
    { id: "malta-ma", name: "Malta", kind: "official", state: "ok", count: 1, terms: "https://mt.example/copyright", reuse: "Not for commercial or marketing use" },
    { id: "invima", name: "INVIMA", kind: "official", state: "ok", count: 1, terms: "https://co.example/by-sa", reuse: "CC BY-SA 4.0: share adaptations under the same licence" },
  ],
};
const ctx = { link: "https://app.example/?q=ibuprofen", generatedAt: "2026-10-27T08:00:00.000Z" };
const rows = exportRows(outcome, sourceTerms(outcome));

describe("FHIR R4 export", () => {
  it("is a Bundle that HL7's R4 JSON Schema accepts, with one Medication per register row and a Provenance", async () => {
    const codes = new Map([["ibuprofen", "5640"]]);
    const bundle = JSON.parse(await toFhirR4(outcome, rows, codes, ctx));
    const ok = validate(bundle);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
    expect(bundle).toMatchObject({ resourceType: "Bundle", type: "collection", timestamp: ctx.generatedAt });
    const types = bundle.entry.map((e: { resource: { resourceType: string } }) => e.resource.resourceType);
    expect(types).toEqual(["Medication", "Medication", "Medication", "Medication", "Provenance"]); // the AI row is left out
    const med = bundle.entry[0].resource;
    expect(med.code.text).toBe("Dolormin");
    expect(med.manufacturer.display).toBe("J&J <GmbH>");
    expect(med.text.div).toContain("J&amp;J &lt;GmbH&gt;");
    expect(med.ingredient[0].itemCodeableConcept).toEqual({ coding: [{ system: RXNORM_SYSTEM, code: "5640" }], text: "Ibuprofen" });
    expect(med.extension.find((e: { url: string }) => e.url === EXT.country).valueCodeableConcept).toEqual({ coding: [{ system: "urn:iso:std:iso:3166", code: "DE" }], text: "Germany" });
    const combo = bundle.entry[1].resource;
    expect(combo.meta.source).toBe("https://example.org/record/2");
    expect(combo.ingredient.map((i: { itemCodeableConcept: { text: string } }) => i.itemCodeableConcept.text)).toEqual(["Pseudoephedrine", "Ibuprofen"]);
    const prov = bundle.entry.at(-1).resource;
    expect(prov.policy).toEqual(["https://ema.example/legal", "https://mt.example/copyright", "https://co.example/by-sa"]);
    expect(prov.target).toHaveLength(4);
    expect(prov.text.div).toContain("National Library of Medicine");
    // each source's condition of reuse travels with its Medication
    const reuseOf = (m: { extension: { url: string; extension?: { url: string; valueString?: string }[] }[] }) =>
      m.extension.find((e) => e.url === EXT.source)?.extension?.find((x) => x.url === "reuse")?.valueString;
    expect(bundle.entry.slice(0, 4).map((e: { resource: never }) => reuseOf(e.resource))).toEqual([
      "Name EMA as the source in every copy",
      "Name EMA as the source in every copy",
      "Not for commercial or marketing use",
      "CC BY-SA 4.0: share adaptations under the same licence",
    ]);
  });

  it("names NLM only when RxNorm codes are used, and the schema really rejects a broken resource", async () => {
    const withoutCodes = JSON.parse(await toFhirR4(outcome, rows, new Map(), ctx));
    expect(withoutCodes.entry.at(-1).resource.text.div).not.toContain("National Library of Medicine");
    expect(validate({ ...withoutCodes, entry: [{ fullUrl: "urn:uuid:x", resource: { resourceType: "Medication", ingredient: "x" } }] })).toBe(false);
  });

  it("leaves out the ingredient element when a row has no ingredient text (FHIR JSON has no empty arrays)", async () => {
    const empty = exportRows({ ...outcome, results: [{ ...outcome.results[0], activeIngredient: "" }] }, sourceTerms(outcome));
    const bundle = JSON.parse(await toFhirR4(outcome, empty, new Map(), ctx));
    expect(bundle.entry[0].resource.ingredient).toBeUndefined();
    expect(validate(bundle)).toBe(true);
  });

  it("makes the same ids without Web Crypto (a copy served over plain http)", async () => {
    const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    expect(hex(sha1(new TextEncoder().encode("abc")))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(hex(sha1(new Uint8Array(0)))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    const subtle = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode("x".repeat(200))));
    expect(hex(sha1(new TextEncoder().encode("x".repeat(200))))).toBe(hex(subtle));
  });

  it("gives the same ids for the same rows (name-based UUIDs)", async () => {
    expect(await uuidV5("x")).toBe(await uuidV5("x"));
    expect(await uuidV5("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const a = JSON.parse(await toFhirR4(outcome, rows, new Map(), ctx));
    const b = JSON.parse(await toFhirR4(outcome, rows, new Map(), ctx));
    expect(a.entry[0].fullUrl).toBe(b.entry[0].fullUrl);
  });

  it("looks up RxNorm codes once per substance, and goes on without the ones RxNav does not know", async () => {
    clearRxnormCache();
    expect(substances("Pseudoephedrine + Ibuprofen")).toEqual(["Pseudoephedrine", "Ibuprofen"]);
    expect(substances("Influenza vaccine, inactivated")).toEqual(["Influenza vaccine, inactivated"]);
    expect(fhirSubstances(rows)).toEqual(["Ibuprofen", "Pseudoephedrine", "Ibuprofeno"]);
    const fetch = stubFetch([
      ["name=ibuprofen", () => jsonResponse({ idGroup: { rxnormId: ["5640"] } })],
      ["name=pseudoephedrine", () => jsonResponse({ idGroup: {} })],
    ]);
    const codes = await rxcuis(["Ibuprofen", "Pseudoephedrine", "ibuprofen"], fetch);
    expect([...codes]).toEqual([["ibuprofen", "5640"]]);
    await rxcuis(["Ibuprofen"], fetch);
    expect(fetch.calls).toHaveLength(2); // remembered
    // past the deadline no new lookup starts: the file is made without those codes
    clearRxnormCache();
    let t = 0;
    const late = await rxcuis(["Ibuprofen"], fetch, () => (t += 20000));
    expect(late.size).toBe(0);
  });
});

describe("XLSX export", () => {
  it("reads back as the same table, with a Sources sheet", () => {
    const bytes = toXlsxFile(outcome, rows, sourceTerms(outcome), ctx);
    const sheet = readFirstSheet(Buffer.from(bytes));
    expect(sheet[0].slice(0, 4)).toEqual(["brand", "active_ingredient", "country", "country_code"]);
    expect(sheet[1].slice(0, 5)).toEqual(["Dolormin", "Ibuprofen", "Germany", "DE", "J&J <GmbH>"]);
    expect(sheet).toHaveLength(1 + outcome.results.length);

    const files = unzip(Buffer.from(bytes), ["xl/worksheets/sheet2.xml", "xl/workbook.xml"]);
    expect(files["xl/workbook.xml"].toString()).toContain('name="Sources"');
    const sources = files["xl/worksheets/sheet2.xml"].toString();
    expect(sources).toContain("https://ema.example/legal");
    // every source's condition of reuse is in the workbook, on its rows and on the Sources sheet
    for (const condition of ["Name EMA as the source in every copy", "Not for commercial or marketing use", "CC BY-SA 4.0: share adaptations under the same licence"]) {
      expect(sheet.some((row) => row.includes(condition)), condition).toBe(true);
      expect(sources).toContain(condition);
    }
  });

  it("names NLM on the Sources sheet when a row comes from RxNorm", () => {
    const rx: SearchOutcome = { ...outcome, results: [{ id: "r", brandName: "Advil", activeIngredient: "ibuprofen", country: "United States", sourceId: "rxnorm", sourceName: "RxNorm (US NLM)", kind: "reference" }] };
    const bytes = toXlsxFile(rx, exportRows(rx, sourceTerms(rx)), sourceTerms(rx), ctx);
    expect(unzip(Buffer.from(bytes), ["xl/worksheets/sheet2.xml"])["xl/worksheets/sheet2.xml"].toString()).toContain("National Library of Medicine");
  });
});
