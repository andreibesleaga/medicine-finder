import { Languages } from "lucide-react";
import { LANGUAGES, useI18n } from "@/i18n";

/** The interface language (the data stays as the registers publish it). */
export const LanguageSwitch = () => {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
      <Languages className="w-4 h-4" aria-hidden="true" />
      <span className="sr-only">{t("app.language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1">
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
};
