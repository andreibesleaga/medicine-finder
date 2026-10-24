// Czech Republic: SÚKL database of medicinal products (DLP), monthly open data. A zip of
// ";"-separated files in windows-1250; the current zip is linked from the catalogue page.
//   dlp_lecivepripravky.csv  one row per pack: KOD_SUKL, NAZEV, SILA, FORMA, DRZ, ZEMDRZ, REG
//   dlp_slozeni.csv          composition: KOD_SUKL, KOD_LATKY, S ("L" = active substance)
//   dlp_latky.csv            substances: KOD_LATKY, NAZEV_INN (Latin), NAZEV_EN
//   dlp_organizace.csv       holders: ZKR_ORG, ZEM, NAZEV ("Name, City")
//   dlp_formy.csv            forms: FORMA, NAZEV_EN

import { unzip } from "../lib/xlsx.js";
import { parseCsv, toRecords } from "../lib/csv.js";
import { tidyCase } from "../lib/text.js";
import { DAY_MS, downloadBuffer, downloadText, joinSubstances } from "./common.js";

export const SUKL_PAGE = "https://opendata.sukl.gov.cz/katalog-otevrenych-dat/databaze-lecivych-pripravku-dlp";
const ZIP_LINK = /https:\/\/opendata\.sukl\.gov\.cz\/soubory\/SOD\d{8}\/DLP\d{8}\.zip/;
// registration states kept (dlp_stavyreg.csv): R registered, B registered after a change
const REGISTERED = new Set(["R", "B"]);
// pack types left out: homeopathics (TYP_LP "HO"); packs with SDOV set are parallel or direct imports
const HOMEOPATHIC = "HO";
// "450MG/50MG" -> "450 mg/50 mg" (only the common mass and volume units)
const tidyStrength = (s) => s.replace(/(\d\s*|\/)(MG|MCG|G|ML)\b/g, (_, p, u) => `${p === "/" ? p : `${p.trim()} `}${u.toLowerCase()}`);
const FILES = {
  products: "dlp_lecivepripravky.csv",
  composition: "dlp_slozeni.csv",
  substances: "dlp_latky.csv",
  organisations: "dlp_organizace.csv",
  forms: "dlp_formy.csv",
};

/** Registered medicines, one row per name, strength, form and holder; no homeopathics or parallel imports. Takes the five files as records. */
export function parseSukl({ products, composition, substances, organisations, forms }) {
  const substanceName = new Map(substances.map((s) => [s.KOD_LATKY, s.NAZEV_EN || s.NAZEV_INN]));
  const actives = new Map();
  for (const c of composition) {
    const name = c.S === "L" && substanceName.get(c.KOD_LATKY);
    if (!name) continue;
    const list = actives.get(c.KOD_SUKL);
    if (list) list.push(name);
    else actives.set(c.KOD_SUKL, [name]);
  }
  const holder = new Map(organisations.map((o) => [`${o.ZKR_ORG}|${o.ZEM}`, o.NAZEV.split(",")[0].trim()]));
  const formName = new Map(forms.map((f) => [f.FORMA, f.NAZEV_EN || f.NAZEV]));
  const seen = new Set();
  const rows = [];
  for (const p of products) {
    const names = actives.get(p.KOD_SUKL);
    if (!REGISTERED.has(p.REG) || !p.NAZEV || !names || p.TYP_LP === HOMEOPATHIC || p.SDOV) continue;
    const key = `${p.NAZEV}|${p.SILA}|${p.FORMA}|${p.DRZ}|${p.ZEMDRZ}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      brand: tidyCase(p.NAZEV),
      ingredient: joinSubstances(names.map(tidyCase)),
      country: "Czech Republic",
      holder: holder.get(`${p.DRZ}|${p.ZEMDRZ}`) || undefined,
      strength: p.SILA ? tidyStrength(p.SILA) : undefined,
      form: formName.get(p.FORMA) || undefined,
      status: "Registered",
    });
  }
  return rows;
}

export const sukl = {
  id: "sukl",
  name: "Czech Republic, SÚKL medicinal products database",
  kind: "official",
  coverage: "Czech Republic, registered human medicinal products (no homeopathics or parallel imports)",
  homepage: "https://prehledy.sukl.cz/prehled_leciv.html",
  terms: "https://opendata.sukl.gov.cz/podminky-uziti-otevrenych-dat",
  // SÚKL publishes a new zip each month
  refreshMs: 7 * DAY_MS,
  load: async (fetchImpl) => {
    const page = await downloadText(fetchImpl, SUKL_PAGE, "utf-8", 60e3);
    const url = ZIP_LINK.exec(page)?.[0];
    if (!url) throw new Error("SÚKL catalogue page: link to the current DLP zip not found");
    const zip = unzip(await downloadBuffer(fetchImpl, url), Object.values(FILES));
    const decoder = new TextDecoder("windows-1250");
    const records = (name) => {
      if (!zip[name]) throw new Error(`SÚKL zip: ${name} missing`);
      return toRecords(parseCsv(decoder.decode(zip[name]), ";"));
    };
    return parseSukl(Object.fromEntries(Object.entries(FILES).map(([key, name]) => [key, records(name)])));
  },
};
