import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./locales/en.json";
import { CODES, STORAGE_KEY, makeT, type Dict } from "./core";
import { loadDictionary } from "./load";
import { I18nContext, type I18n } from "./context";

interface Props {
  children: ReactNode;
  countryCode: (name: string) => string | undefined;
  /** the language and its dictionary, loaded before the first render (main.tsx), so no English flashes first */
  initial?: { lang: string; dict: Dict };
}

export function I18nProvider({ children, countryCode, initial }: Props) {
  // language and dictionary change together, so a plural rule is never applied to another language's text
  const [state, setState] = useState(initial ?? { lang: "en", dict: en as Dict });
  const { lang, dict } = state;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: string) => {
    if (!CODES.has(next)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // not remembered; still switched for this page
    }
    void loadDictionary(next).then((d) => setState({ lang: next, dict: d }));
  }, []);

  const value = useMemo<I18n>(() => {
    const names = new Intl.DisplayNames([lang], { type: "region" });
    const countryName = (name: string, code = countryCode(name)) => {
      if (!code) return name;
      try {
        return names.of(code) ?? name;
      } catch {
        return name;
      }
    };
    return { lang, setLang, t: makeT(lang, dict), countryName };
  }, [lang, dict, setLang, countryCode]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
