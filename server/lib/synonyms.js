// Other international names of the same ingredient (server/data/synonyms.json).

import { readFileSync } from "node:fs";
import { normalize } from "./text.js";

const synonymGroups = JSON.parse(readFileSync(new URL("../data/synonyms.json", import.meta.url), "utf8")).groups;

/** The term plus its other names ("acetaminophen" -> ["acetaminophen", "paracetamol", "acetaminofen"]). */
export function withSynonyms(term) {
  // accents and case do not matter: "Acetaminofén" is in the same group as "acetaminofen"
  const t = normalize(term);
  const group = synonymGroups.find((names) => names.includes(t));
  return group ? [t, ...group.filter((name) => name !== t)] : [t];
}
