import type { MedicineResult } from "@/types/medicine";
import { CURATED_LISTS, SYNONYMS } from "./curatedLists";

export const CURATED_SOURCE = {
  id: "curated",
  name: "Curated sample (static list, not from a regulator)",
  kind: "curated" as const,
};

/** Looks the ingredient up in the static lists. */
export function searchCurated(term: string): Omit<MedicineResult, "id">[] {
  const key = term.trim().toLowerCase();
  const ingredient = SYNONYMS[key] ?? key;
  return CURATED_LISTS.flatMap((list) =>
    (list.brands[ingredient] ?? []).map((b) => ({
      brandName: b.brand,
      activeIngredient: b.ingredients ?? ingredient,
      country: list.country,
      manufacturer: b.manufacturer,
      sourceId: CURATED_SOURCE.id,
      sourceName: CURATED_SOURCE.name,
      kind: CURATED_SOURCE.kind,
    })),
  );
}
