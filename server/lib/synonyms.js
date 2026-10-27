// Other international names of the same ingredient: server/data/synonyms.json (made by hand: national
// spellings and US/INN pairs) and server/data/unii-synonyms.json (generated from the FDA's UNII list:
// official names of each substance, see scripts/build-unii-synonyms.mjs).

import { readFileSync } from "node:fs";
import { normalize, stems } from "./text.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8")).groups;
const synonymGroups = read("synonyms.json");
const uniiGroups = read("unii-synonyms.json");

// name -> every other name of it; hand-made names first
const index = new Map();
for (const group of [...synonymGroups, ...uniiGroups]) {
  const all = [...new Set([...group.flatMap((n) => index.get(n) ?? []), ...group])];
  for (const n of all) index.set(n, all);
}

// Latin names of elements that are not a prefix of the English word, as registers in Latvia, Poland,
// Hungary or Romania write them ("Natrii hydrogenocarbonas"). Other Latin forms already match by word
// beginnings: "paracetamol" finds "Paracetamolum", "calcium carbonate" finds "Calcii carbonas".
const LATIN_WORDS = {
  sodium: ["natrii", "natrium"],
  potassium: ["kalii", "kalium"],
  iron: ["ferri", "ferrosi", "ferrum"],
  ferrous: ["ferrosi"],
  ferric: ["ferri"],
  copper: ["cupri"],
  silver: ["argenti"],
  water: ["aqua"],
};

/** "sodium fluoride" -> ["natrii fluoride", "natrium fluoride"]: the term with a Latin element name. */
function latinVariants(name) {
  const words = name.split(" ");
  const out = [];
  words.forEach((w, i) => {
    for (const latin of LATIN_WORDS[w] ?? []) out.push([...words.slice(0, i), latin, ...words.slice(i + 1)].join(" "));
  });
  return out;
}

/**
 * The international name of an ingredient when the synonym list has it ("ACETAMINOPHEN" ->
 * "Paracetamol"; each group starts with that name); otherwise the name as given.
 */
export function preferredName(ingredient) {
  const group = synonymGroups.find((names) => names.includes(normalize(ingredient)));
  if (!group || group[0] === normalize(ingredient)) return ingredient;
  return group[0].replace(/(^|\s)(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
}

/** True when searching `a` finds whatever searching `b` finds: each stem of `a` begins the one of `b`. */
function covers(a, b) {
  const [x, y] = [stems(a), stems(b)];
  return x.length === y.length && x.every((s, i) => y[i].startsWith(s));
}

/** The term plus its other names ("acetaminophen" -> ["acetaminophen", "paracetamol", "acetaminofen"]). */
export function withSynonyms(term) {
  // accents and case do not matter: "Acetaminofén" is in the same group as "acetaminofen"
  const t = normalize(term);
  const group = index.get(t);
  const names = group ? [t, ...group.filter((name) => name !== t)] : [t];
  return [...new Set([...names, ...names.flatMap(latinVariants)])];
}

/**
 * The names to send to a search: `withSynonyms` without a name an earlier one already finds
 * ("paracetamolum" after "paracetamol", as word beginnings match), so a live source is not asked
 * twice for the same thing.
 */
export function searchNames(term) {
  const kept = [];
  for (const n of withSynonyms(term)) if (!kept.some((k) => covers(k, n))) kept.push(n);
  return kept;
}
