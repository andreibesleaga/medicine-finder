// Spain: CIMA, the medicines database of AEMPS (live REST API, no key).

import { fetchJson } from "../lib/http.js";
import { stems, splitProductName, tidyCase } from "../lib/text.js";
import { searchNames } from "../lib/synonyms.js";

const API = "https://cima.aemps.es/cima/rest/medicamentos";

/** Maps one page of CIMA results to medicine results. */
export function mapCima(json, term) {
  const rows = Array.isArray(json?.resultados) ? json.resultados : [];
  return rows.map((r) => {
    const { brand, strength } = splitProductName(r.nombre || "");
    return {
      brandName: tidyCase(brand),
      activeIngredient: r.vtm?.nombre ? tidyCase(r.vtm.nombre) : term,
      country: "Spain",
      manufacturer: r.labtitular || undefined,
      strength: r.dosis || strength,
      dosageForm: r.formaFarmaceutica?.nombre ? tidyCase(r.formaFarmaceutica.nombre) : undefined,
      status: r.receta ? "Prescription only" : "Without prescription",
      url: `https://cima.aemps.es/cima/publico/detalle.html?nregistro=${encodeURIComponent(r.nregistro)}`,
    };
  });
}

export function createCimaSource({ fetch }) {
  return {
    id: "cima",
    name: "Spain, CIMA (AEMPS)",
    kind: "official",
    countries: ["Spain"],
    coverage: "Spain, marketed medicines",
    homepage: "https://cima.aemps.es/",
    terms: "https://cima.aemps.es/",
    enabled: () => true,
    status: () => ({ state: "live" }),
    async search(term) {
      // CIMA matches the start of the Spanish substance name; the stem bridges English and Spanish
      // spellings, and the other international name (acetaminophen -> paracetamol) is tried too
      const pages = await Promise.allSettled(
        searchNames(term).map((name) =>
          fetchJson(fetch, `${API}?practiv1=${encodeURIComponent(stems(name).join(" "))}&comerc=1&pagina=1`, { timeoutMs: 12000 }),
        ),
      );
      const answered = pages.filter((p) => p.status === "fulfilled").map((p) => p.value);
      if (!answered.length) throw pages[0].reason;
      // the first page of each name is shown; totalFilas says how many CIMA has in all
      const seen = new Map();
      let total = 0;
      for (const json of answered) {
        total = Math.max(total, Number(json?.totalFilas) || 0);
        for (const r of mapCima(json, term)) if (!seen.has(r.url)) seen.set(r.url, r);
      }
      return { total: Math.max(total, seen.size), results: [...seen.values()] };
    },
  };
}
