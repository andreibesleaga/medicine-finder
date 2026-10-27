import { createContext, useContext } from "react";
import en from "./locales/en.json";
import { makeT, type Dict } from "./core";

export interface I18n {
  lang: string;
  setLang: (lang: string) => void;
  t: ReturnType<typeof makeT>;
  /** a country name (English, as the data writes it) in the chosen language */
  countryName: (name: string, code?: string) => string;
}

export const I18nContext = createContext<I18n>({
  lang: "en",
  setLang: () => {},
  t: makeT("en", en as Dict),
  countryName: (name) => name,
});

export const useI18n = () => useContext(I18nContext);
