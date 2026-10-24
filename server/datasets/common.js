// Helpers shared by the dataset loaders.

import { readFileSync } from "node:fs";
import { fetchChecked } from "../lib/http.js";

export const DAY_MS = 24 * 3600e3;

/** Downloads a file and returns it as text in the given encoding. Big national files can be slow. */
export async function downloadText(fetchImpl, url, encoding = "utf-8", timeoutMs = 10 * 60e3) {
  const res = await fetchChecked(fetchImpl, url, { timeoutMs });
  return new TextDecoder(encoding).decode(await res.arrayBuffer());
}

export async function downloadBuffer(fetchImpl, url, timeoutMs = 10 * 60e3) {
  const res = await fetchChecked(fetchImpl, url, { timeoutMs });
  return Buffer.from(await res.arrayBuffer());
}

/** Joins several substance names: ["A", "B"] -> "A + B". */
export const joinSubstances = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))].join(" + ");

const synonymPairs = JSON.parse(readFileSync(new URL("../data/synonyms.json", import.meta.url), "utf8")).pairs;

/** The term plus its other international names ("acetaminophen" -> ["acetaminophen", "paracetamol"]). */
export function withSynonyms(term) {
  const t = term.trim().toLowerCase();
  const out = [t];
  for (const [a, b] of synonymPairs) {
    if (t === a) out.push(b);
    else if (t === b) out.push(a);
  }
  return out;
}
