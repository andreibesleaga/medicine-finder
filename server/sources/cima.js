// Spain: CIMA, the medicines database of AEMPS (live REST API, no key).

import { fetchJson } from "../lib/http.js";
import { stems, splitProductName, tidyCase } from "../lib/text.js";

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
    coverage: "Spain, marketed medicines",
    homepage: "https://cima.aemps.es/",
    enabled: () => true,
    status: () => ({ state: "live" }),
    async search(term) {
      // CIMA matches the start of the Spanish substance name; the stem bridges English and Spanish spellings
      const query = stems(term).join(" ");
      const json = await fetchJson(fetch, `${API}?practiv1=${encodeURIComponent(query)}&comerc=1&pagina=1`, { timeoutMs: 12000 });
      return mapCima(json, term);
    },
  };
}
