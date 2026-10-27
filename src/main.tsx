import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initialLanguage, type Dict } from "./i18n/core";
import { loadDictionary } from "./i18n/load";
import en from "./i18n/locales/en.json";

// the page's language is loaded first (a few KB), so the first render is already in it
const render = (lang: string, dict: Dict) => createRoot(document.getElementById("root")!).render(<App i18n={{ lang, dict }} />);
const lang = initialLanguage();
loadDictionary(lang).then(
  (dict) => render(lang, dict),
  () => render("en", en as Dict),
);
