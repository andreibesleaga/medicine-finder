import { useI18n } from "@/i18n";

export const Disclaimer = () => {
  const { t } = useI18n();
  return (
    <p className="max-w-3xl mx-auto mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <strong>{t("disclaimer.title")}</strong> {t("disclaimer.text")}
    </p>
  );
};
