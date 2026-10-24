// Finland: Fimea basic register of medicinal products (Perusrekisteri.xml, about 200 MB; CC BY 4.0).
// fimea.fi answers scripts with a browser check, so the server cannot download it: the file is
// downloaded by hand from https://fimea.fi/en/databases_and_registers/basic-register-xml and
// placed in the imports folder of DATA_DIR (on Railway: `railway volume files upload`). The
// dataset is reloaded whenever a newer file is put there. Elements used:
//   <Pakkaus Laakevalmiste-ref="REL…">  package: <Kaupan>1</Kaupan> on the market, <Pakkaus_Laakeaine Laakeaine-ref="RES…"/>
//   <Laakevalmiste id="REL…">           product: Kauppanimi (brand), Vahvuus, Laakemuoto, HUM,
//                                         Myyntilupa > Haltija, Tila (status id), RinnakkaisTuonti
//   <Laakeaine id="RES…">               substances: VaikuttavaAine > Aine value (English name)

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { decodeXml as decode } from "../lib/text.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, joinSubstances } from "./common.js";

export const FIMEA_FILE = "Perusrekisteri.xml";
// authorisation status ids: 5 marketing authorisation granted, 18 registration granted
const CURRENT = new Set(["5", "18"]);

const text = (xml, tag) => decode(new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1]?.trim() ?? "");
const attr = (xml, tag, name) => decode(new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`).exec(xml)?.[1]?.trim() ?? "");

/** Human medicines with a current authorisation or registration, not parallel imports. */
export function parseFimea(xml) {
  // packages come first: which substances each product has, and whether any pack is on sale
  const packs = new Map();
  for (const [, productId, body] of xml.matchAll(/<Pakkaus Laakevalmiste-ref="([^"]+)">([\s\S]*?)<\/Pakkaus>/g)) {
    let p = packs.get(productId);
    if (!p) packs.set(productId, (p = { substances: new Set(), marketed: false }));
    if (/<Kaupan>1<\/Kaupan>/.test(body)) p.marketed = true;
    for (const [, ref] of body.matchAll(/Laakeaine-ref="([^"]+)"/g)) p.substances.add(ref);
  }
  const substanceNames = new Map();
  for (const [, id, body] of xml.matchAll(/<Laakeaine id="([^"]+)">([\s\S]*?)<\/Laakeaine>/g)) {
    substanceNames.set(id, [...body.matchAll(/<Aine\b[^>]*\bvalue="([^"]*)"/g)].map((m) => decode(m[1]).trim()));
  }
  const rows = [];
  const seen = new Set();
  for (const [, id, body] of xml.matchAll(/<Laakevalmiste id="([^"]+)">([\s\S]*?)<\/Laakevalmiste>/g)) {
    const brand = text(body, "Kauppanimi");
    const pack = packs.get(id);
    if (!brand || !pack || text(body, "HUM") !== "1" || text(body, "RinnakkaisTuonti") === "1") continue;
    if (!CURRENT.has(attr(body, "Tila", "id"))) continue;
    const names = [...pack.substances].flatMap((ref) => substanceNames.get(ref) ?? []);
    if (!names.length) continue;
    const row = {
      brand: tidyCase(brand),
      ingredient: joinSubstances(names),
      country: "Finland",
      holder: text(body, "Haltija") || undefined,
      strength: text(body, "Vahvuus") || undefined,
      form: attr(body, "Laakemuoto", "value") || undefined,
      status: pack.marketed ? "Authorised, marketed" : "Authorised",
    };
    // products with the same name often repeat every field
    const key = [row.brand, row.ingredient, row.strength, row.form, row.holder].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

const filePath = (ctx) => path.join(ctx.importDir ?? "", FIMEA_FILE);

export const fimea = {
  id: "fimea",
  name: "Finland, Fimea basic register of medicinal products",
  kind: "official",
  coverage: "Finland, authorised human medicines (imported file, not parallel imports)",
  homepage: "https://fimea.fi/en/databases_and_registers/basic-register-xml",
  terms: "https://avoindata.suomi.fi/data/en/dataset/fimea-avoin-data",
  refreshMs: 30 * DAY_MS,
  // only when the file has been imported; reloaded when a newer one is put in place
  available: (ctx) => Boolean(ctx.importDir) && existsSync(filePath(ctx)),
  unavailableDetail: `no file imported yet (${FIMEA_FILE} in DATA_DIR/imports)`,
  modifiedAt: (ctx) => statSync(filePath(ctx)).mtimeMs,
  load: async (_fetch, ctx) => parseFimea(readFileSync(filePath(ctx), "utf8")),
};
