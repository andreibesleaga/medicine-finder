import en from "./locales/en.json";
import type { Dict } from "./core";

// English is built in; the others are fetched when chosen
const loaders = import.meta.glob<{ default: Dict }>(["./locales/*.json", "!./locales/en.json"]);

/** The dictionary of a language (English for an unknown one). */
export async function loadDictionary(lang: string): Promise<Dict> {
  const load = loaders[`./locales/${lang}.json`];
  return lang === "en" || !load ? (en as Dict) : (await load()).default;
}

