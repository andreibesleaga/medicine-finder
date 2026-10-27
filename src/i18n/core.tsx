// Interface languages without a library: one JSON dictionary per language in ./locales (English
// built in, the others loaded when chosen), a React context, and t() with {placeholders} and plural
// forms by Intl.PluralRules ("key_one", "key_few", "key_other"…). Data from the registers (brands,
// ingredients, statuses, source names) is never translated; country names come from the browser's
// own Intl.DisplayNames in the chosen language.

import type { ReactNode } from "react";
import en from "./locales/en.json";

export type Dict = Record<string, string>;

/** The 20 interface languages: BCP 47 tag and the language's own name. */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "pl", name: "Polski" },
  { code: "nl", name: "Nederlands" },
  { code: "ro", name: "Română" },
  { code: "cs", name: "Čeština" },
  { code: "hu", name: "Magyar" },
  { code: "el", name: "Ελληνικά" },
  { code: "sv", name: "Svenska" },
  { code: "da", name: "Dansk" },
  { code: "fi", name: "Suomi" },
  { code: "nb", name: "Norsk bokmål" },
  { code: "uk", name: "Українська" },
  { code: "lt", name: "Lietuvių" },
  { code: "ja", name: "日本語" },
  { code: "zh-Hant", name: "繁體中文" },
];
export const CODES = new Set(LANGUAGES.map((l) => l.code));
export const STORAGE_KEY = "mf-lang";

/** The language a browser asks for, among ours: "pt-BR" -> "pt", "nn" -> "nb", "zh-TW" -> "zh-Hant". */
export function matchLanguage(wanted: readonly string[]): string {
  for (const tag of wanted) {
    const lower = tag.toLowerCase();
    if (/^zh-(tw|hk|mo|hant)/.test(lower)) return "zh-Hant";
    const primary = lower.split("-")[0];
    if (primary === "no" || primary === "nn") return "nb";
    if (CODES.has(primary)) return primary;
  }
  return "en";
}

export function initialLanguage(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl && CODES.has(fromUrl)) return fromUrl;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && CODES.has(saved)) return saved;
  } catch {
    // storage blocked: use the browser's language
  }
  return typeof navigator === "undefined" ? "en" : matchLanguage(navigator.languages ?? [navigator.language]);
}

export type Vars = Record<string, string | number>;

/** A translator over a dictionary, English underneath. Exported for tests. */
export function makeT(lang: string, dict: Dict) {
  const plural = new Intl.PluralRules(lang);
  const pick = (key: string, vars?: Vars) => {
    if (vars && typeof vars.n === "number") {
      const form = `${key}_${plural.select(vars.n)}`;
      const plain = dict[form] ?? dict[`${key}_other`] ?? (en as Dict)[`${key}_${new Intl.PluralRules("en").select(vars.n)}`] ?? (en as Dict)[`${key}_other`];
      if (plain !== undefined) return plain;
    }
    // a key without plural forms, even when it is given a number
    return dict[key] ?? (en as Dict)[key];
  };
  return (key: string, vars?: Vars): string => {
    const text = pick(key, vars) ?? key;
    return text.replace(/\{(\w+)\}/g, (m, name) => (vars && name in vars ? String(vars[name]) : m));
  };
}

/** Like t(), but placeholders may be React nodes (bold names, links). */
export function rich(text: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && name in nodes ? <span key={i}>{nodes[name]}</span> : part;
  });
}

