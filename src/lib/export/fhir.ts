// FHIR R4 Bundle of the results, for health-record systems: one Medication per brand (brand as
// code.text, ingredients coded with RxNorm where RxNav knows them, form, holder as manufacturer) and
// one Provenance naming every source and its terms. Country, strength, status and source have no
// Medication element in R4, so they travel in extensions defined under /fhir/StructureDefinition/.
// AI suggestions are left out: a record system should only receive register data.

import type { SearchOutcome } from "@/types/medicine";
import type { ExportContext, ExportRow } from "./exportResults";
import { NLM_ATTRIBUTION, NOT_MEDICAL_ADVICE } from "./exportResults";
import { RXNORM_SYSTEM, substances } from "./rxnorm";

export const FHIR_BASE = "https://medicine-finder.up.railway.app/fhir/StructureDefinition";
export const EXT = {
  country: `${FHIR_BASE}/medicine-country`,
  strength: `${FHIR_BASE}/medicine-strength`,
  status: `${FHIR_BASE}/medicine-status`,
  source: `${FHIR_BASE}/medicine-source`,
};
const ISO_3166 = "urn:iso:std:iso:3166";
// fixed namespace for this app's name-based (version 5) UUIDs, so the same row always gets the same id
const NAMESPACE = "5d0e6a52-3b1f-4c6e-9d7a-1f2b3c4d5e6f";

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const narrative = (html: string) => ({ status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>` });

/** SHA-1 without Web Crypto (a copy served over plain http has no crypto.subtle). */
export function sha1(bytes: Uint8Array): Uint8Array {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  const bitLen = bytes.length * 8;
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
  words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;
  let [a, b, c, d, e] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80);
  const rol = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < words.length; i += 16) {
    const [oa, ob, oc, od, oe] = [a, b, c, d, e];
    for (let j = 0; j < 80; j++) {
      w[j] = j < 16 ? words[i + j] | 0 : rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      const [f, k] = j < 20 ? [(b & c) | (~b & d), 0x5a827999] : j < 40 ? [b ^ c ^ d, 0x6ed9eba1] : j < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const tmp = (rol(a, 5) + f + e + k + w[j]) | 0;
      [e, d, c, b, a] = [d, c, rol(b, 30), a, tmp];
    }
    [a, b, c, d, e] = [(a + oa) | 0, (b + ob) | 0, (c + oc) | 0, (d + od) | 0, (e + oe) | 0];
  }
  const out = new Uint8Array(20);
  [a, b, c, d, e].forEach((x, i) => new DataView(out.buffer).setUint32(i * 4, x >>> 0));
  return out;
}

/** RFC 4122 version 5 UUID (SHA-1 of namespace + name). */
export async function uuidV5(name: string, namespace = NAMESPACE): Promise<string> {
  const ns = Uint8Array.from(namespace.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16)));
  const data = new Uint8Array([...ns, ...new TextEncoder().encode(name)]);
  const digest = globalThis.crypto?.subtle ? new Uint8Array(await crypto.subtle.digest("SHA-1", data)) : sha1(data);
  const hash = digest.slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Every substance name of the rows that go into a FHIR file (for the RxNorm lookup). */
export function fhirSubstances(rows: ExportRow[]): string[] {
  return [...new Set(rows.filter((r) => r.sourceType !== "ai").flatMap((r) => substances(r.activeIngredient)))];
}

function medication(id: string, r: ExportRow, codes: Map<string, string>) {
  const sourceExt = [
    { url: "name", valueString: r.source },
    { url: "type", valueCode: r.sourceType },
    ...(r.sourceTerms.startsWith("http") ? [{ url: "terms", valueUri: r.sourceTerms.split(" ; ")[0] }] : []),
    ...(r.reuseCondition ? [{ url: "reuse", valueString: r.reuseCondition }] : []),
  ];
  const extension = [
    { url: EXT.country, valueCodeableConcept: { ...(r.countryCode ? { coding: [{ system: ISO_3166, code: r.countryCode }] } : {}), text: r.country } },
    ...(r.strength ? [{ url: EXT.strength, valueString: r.strength }] : []),
    ...(r.status ? [{ url: EXT.status, valueString: r.status }] : []),
    { url: EXT.source, extension: sourceExt },
  ];
  return {
    resourceType: "Medication",
    id,
    ...(r.recordUrl ? { meta: { source: r.recordUrl } } : {}),
    text: narrative(
      `${escapeXml(r.brand)}: ${escapeXml(r.activeIngredient)} (${escapeXml(r.country)})${r.holder ? `, ${escapeXml(r.holder)}` : ""}; source: ${escapeXml(r.source)}`,
    ),
    extension,
    code: { text: r.brand },
    ...(r.holder ? { manufacturer: { display: r.holder } } : {}),
    ...(r.dosageForm ? { form: { text: r.dosageForm } } : {}),
    // FHIR JSON allows no empty arrays: a row without ingredient text has no ingredient element
    ...(substances(r.activeIngredient).length
      ? {
          ingredient: substances(r.activeIngredient).map((name) => {
            const code = codes.get(name.toLowerCase());
            return { itemCodeableConcept: { ...(code ? { coding: [{ system: RXNORM_SYSTEM, code }] } : {}), text: name }, isActive: true };
          }),
        }
      : {}),
  };
}

/** The Bundle as JSON text; `codes` are RxCUIs by lower-case substance name. */
export async function toFhirR4(outcome: SearchOutcome, rows: ExportRow[], codes: Map<string, string>, ctx: ExportContext): Promise<string> {
  const kept = rows.filter((r) => r.sourceType !== "ai");
  const ids = await Promise.all(kept.map((r) => uuidV5([r.source, r.brand, r.country, r.strength, r.dosageForm].join("|"))));
  const meds = kept.map((r, i) => medication(ids[i], r, codes));
  const sources = [...new Map(kept.map((r) => [r.source, r])).values()];
  const policies = [...new Set(kept.flatMap((r) => r.sourceTerms.split(" ; ")).filter((t) => t.startsWith("http")))];
  const usesNlm = codes.size > 0 || kept.some((r) => r.reuseCondition.includes(NLM_ATTRIBUTION));
  const provenanceId = await uuidV5(`provenance|${outcome.term}|${outcome.country ?? ""}|${ctx.generatedAt}`);
  const provenance = {
    resourceType: "Provenance",
    id: provenanceId,
    text: narrative(
      [
        `Brand names of ${escapeXml(outcome.term)} from Medicine Brand Finder (${escapeXml(ctx.link)}).`,
        "Each Medication keeps its source's terms and condition of reuse.",
        usesNlm ? escapeXml(NLM_ATTRIBUTION) : "",
        escapeXml(NOT_MEDICAL_ADVICE),
      ]
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join(""),
    ),
    target: ids.length ? ids.map((id) => ({ reference: `urn:uuid:${id}` })) : [{ display: "no results" }],
    recorded: ctx.generatedAt,
    ...(policies.length ? { policy: policies } : {}),
    agent: [{ who: { display: "Medicine Brand Finder" } }],
    entity: sources.map((r) => ({ role: "source", what: { display: r.source } })),
  };
  const bundle = {
    resourceType: "Bundle",
    id: await uuidV5(`bundle|${provenanceId}`),
    meta: { lastUpdated: ctx.generatedAt },
    type: "collection",
    timestamp: ctx.generatedAt,
    entry: [
      ...meds.map((m) => ({ fullUrl: `urn:uuid:${m.id}`, resource: m })),
      { fullUrl: `urn:uuid:${provenanceId}`, resource: provenance },
    ],
  };
  return `${JSON.stringify(bundle, null, 2)}\n`;
}
