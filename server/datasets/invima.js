// Colombia: INVIMA "Código Único de Medicamentos Vigentes" on datos.gov.co (CSV, one row per
// active ingredient per presentation; licence CC BY-SA 4.0, attribution to INVIMA).

import { parseCsv, toRecords } from "../lib/csv.js";
import { cutAt, cutAtAmount, cutProductTitle, tidyCase, uniqueRows } from "../lib/text.js";
import { DAY_MS, downloadText, joinSubstances } from "./common.js";

// the portal filters and trims the columns server-side: a quarter of the full file
export const INVIMA_URL =
  "https://www.datos.gov.co/resource/i7cb-raxc.csv?$select=expediente,producto,titular,principioactivo,cantidad,unidadmedida,formafarmaceutica" +
  "&$where=estadoregistro%3D%27Vigente%27%20AND%20estadocum%3D%27Activo%27&$limit=500000";

// "IBUPROFENO GRANULADO (IBUPROFENO 85% + ...) 235.3 MG EQUIVALENTE A IBUPROFENO" -> "Ibuprofeno Granulado"
// (also "500 MG DE PARACETAMOL" -> "Paracetamol", "ACIDO ACETILSALICILICOEQUIVALENTE A" -> "Acido Acetilsalicilico")
const LEADING_AMOUNT = /^[\d.,]+\s*[a-z]{1,3}\s+(?:de\s+)?/i;
const substanceName = (s) => tidyCase(cutAtAmount(cutAt(s.replace(LEADING_AMOUNT, ""), /\s*\(|equivalente/i)));

/** Rows of current registrations with an active presentation (filtered by the query), one per registration (expediente). */
export function parseInvima(records) {
  const byFile = new Map();
  for (const r of records) {
    if (!r.producto || !r.principioactivo) continue;
    let p = byFile.get(r.expediente);
    if (!p) {
      p = { r, substances: new Set(), strengths: new Set() };
      byFile.set(r.expediente, p);
    }
    const name = substanceName(r.principioactivo);
    if (/\p{L}/u.test(name)) p.substances.add(name);
    if (r.cantidad) p.strengths.add(`${r.cantidad} ${r.unidadmedida}`.trim());
  }
  const rows = [...byFile.values()]
    .filter((p) => p.substances.size)
    .map(({ r, substances, strengths }) => ({
      // "RYTMONORM® 300 MG TABLETAS" -> "Rytmonorm"
      brand: tidyCase(cutProductTitle(r.producto.replace(/\s*®\s*/g, " ").replace(/\s+/g, " "))),
      ingredient: joinSubstances([...substances]),
      country: "Colombia",
      holder: r.titular ? tidyCase(r.titular) : undefined,
      strength: [...strengths].slice(0, 4).join(" / ") || undefined,
      form: r.formafarmaceutica ? tidyCase(r.formafarmaceutica) : undefined,
      status: "Registered (vigente)",
    }));
  return uniqueRows(rows);
}

export const invima = {
  id: "invima",
  name: "Colombia, INVIMA registered medicines (CUM)",
  kind: "official",
  countries: ["Colombia"],
  coverage: "Colombia, medicines with a current registration and an active presentation",
  homepage: "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-digo-nico-de-Medicamentos-Vigentes/i7cb-raxc",
  terms: "https://creativecommons.org/licenses/by-sa/4.0/",
  reuse: "CC BY-SA 4.0: name INVIMA as the source and share adaptations under the same licence",
  refreshMs: DAY_MS,
  load: async (fetchImpl) => parseInvima(toRecords(parseCsv(await downloadText(fetchImpl, INVIMA_URL)))),
};
