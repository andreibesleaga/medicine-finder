// The static "curated sample" lists, loaded into the database like the other datasets.

import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/curated.json", import.meta.url), "utf8"));

export function curatedRows() {
  const aliases = Object.fromEntries(Object.entries(data.synonyms).map(([alias, main]) => [main, alias]));
  return data.lists.flatMap((list) =>
    Object.entries(list.brands).flatMap(([ingredient, brands]) =>
      brands.map((b) => ({
        brand: b.brand,
        // the other name is kept in brackets so a search for either finds the row
        ingredient: b.ingredients ?? (aliases[ingredient] ? `${ingredient} (${aliases[ingredient]})` : ingredient),
        country: list.country,
        holder: b.manufacturer,
      })),
    ),
  );
}

export const curated = {
  id: "curated",
  name: "Curated sample (static list, not from a regulator)",
  kind: "curated",
  coverage: `Static lists for ${data.lists.map((l) => l.country).join(", ")}; a few common ingredients only`,
  homepage: "https://github.com/andreibesleaga/medicine-finder/blob/main/server/data/curated.json",
  refreshMs: 0,
  load: async () => curatedRows(),
};
