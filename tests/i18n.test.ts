import { describe, it, expect } from "vitest";
import { LANGUAGES, makeT, matchLanguage, type Dict } from "@/i18n";
import en from "@/i18n/locales/en.json";

const files = import.meta.glob<{ default: Dict }>("../src/i18n/locales/*.json", { eager: true });
const dicts = Object.fromEntries(Object.entries(files).map(([path, m]) => [path.split("/").pop()!.replace(".json", ""), m.default]));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const PLURAL = /_(zero|one|two|few|many|other)$/;
const bases = [...new Set(Object.keys(en).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, "")))];

describe("interface languages", () => {
  it("has a dictionary for each of the 20 languages", () => {
    expect(LANGUAGES).toHaveLength(20);
    expect(Object.keys(dicts).sort()).toEqual(LANGUAGES.map((l) => l.code).sort());
  });

  it.each(LANGUAGES.filter((l) => l.code !== "en").map((l) => l.code))("%s: every key, every placeholder, every plural form", (code) => {
    const d = dicts[code];
    expect(d["_meta.status"], "marked as machine-translated until reviewed").toMatch(/machine-translated|reviewed/);
    for (const [key, text] of Object.entries(en as Dict)) {
      if (PLURAL.test(key) || key.startsWith("_meta")) continue;
      expect(d[key], `${code}: ${key}`).toBeTypeOf("string");
      expect(placeholders(d[key]), `${code}: ${key}`).toEqual(placeholders(text));
    }
    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const base of bases) {
      for (const cat of categories) {
        const key = `${base}_${cat}`;
        expect(d[key], `${code}: ${key}`).toBeTypeOf("string");
        // a form may leave out {n} (Polish "jedna nazwa"), but never adds a placeholder English does not have
        const allowed = new Set(placeholders((en as Dict)[`${base}_other`]));
        for (const p of placeholders(d[key])) expect(allowed.has(p), `${code}: ${key} {${p}}`).toBe(true);
      }
    }
  });

  it("translates with placeholders, the language's plural rules, and English underneath", () => {
    const t = makeT("pl", { "results.countries_one": "kraj", "results.countries_few": "kraje", "results.countries_many": "krajów", "x.only": "{a}!" });
    expect(t("results.countries", { n: 1 })).toBe("kraj");
    expect(t("results.countries", { n: 3 })).toBe("kraje");
    expect(t("results.countries", { n: 5 })).toBe("krajów");
    expect(t("x.only", { a: "b" })).toBe("b!");
    expect(t("ready.title")).toBe("Ready to search"); // missing here: English
    expect(t("unknown.key")).toBe("unknown.key");
    // a key without plural forms still works when given a number
    expect(makeT("en", en as Dict)("progress.found", { n: 3 })).toBe("3 found");
  });

  it("picks the browser's language among the 20", () => {
    expect(matchLanguage(["pt-BR", "en"])).toBe("pt");
    expect(matchLanguage(["nn-NO"])).toBe("nb");
    expect(matchLanguage(["zh-TW"])).toBe("zh-Hant");
    expect(matchLanguage(["zh-CN", "fr"])).toBe("fr");
    expect(matchLanguage(["ko"])).toBe("en");
  });
});
