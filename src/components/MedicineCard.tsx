import type { MedicineResult } from "@/types/medicine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building, Pill, FlaskConical, ExternalLink, AlertTriangle } from "lucide-react";
import { getRegionForCountry } from "@/constants/countries";
import { webUrl } from "@/lib/utils";
import { KIND_CLASS } from "./sourceLabels";
import { useI18n } from "@/i18n";

interface MedicineCardProps {
  medicine: MedicineResult;
}

export const MedicineCard = ({ medicine: m }: MedicineCardProps) => {
  const { t, countryName } = useI18n();
  const region = m.country === "Not stated" || m.country === "European Union" ? "" : getRegionForCountry(m.country);
  // a curated or AI name also found in a database (not just another AI answer) needs no warning
  const recordUrl = webUrl(m.url);
  const confirmedByData = (m.alsoIn ?? []).some((name) => !name.startsWith("AI suggestion"));

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-gray-200 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-lg font-semibold text-gray-900 leading-tight [overflow-wrap:anywhere]">{m.brandName}</CardTitle>
          <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${KIND_CLASS[m.kind]}`}>{t(`kind.${m.kind}`)}</span>
        </div>
        <p className="text-xs text-gray-600">{m.sourceName}</p>
      </CardHeader>

      <CardContent className="space-y-2 text-sm flex-1 flex flex-col [overflow-wrap:anywhere]">
        <div className="flex items-start gap-2">
          <Pill className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="text-gray-600">{t("card.active")}</span>
          <span className="font-medium text-gray-900">{m.activeIngredient}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-green-700 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="text-gray-600">{t("card.country")}</span>
          <span className="font-medium text-gray-900">
            {countryName(m.country)}
            {region && region !== m.country && <span className="block text-xs font-normal text-gray-600">{t(`region.${region}`)}</span>}
          </span>
        </div>
        {m.manufacturer && (
          <div className="flex items-start gap-2">
            <Building className="w-4 h-4 text-orange-700 mt-0.5 shrink-0" aria-hidden="true" />
            <span className="text-gray-600">{t("card.holder")}</span>
            <span className="font-medium text-gray-900">{m.manufacturer}</span>
          </div>
        )}
        {(m.strength || m.dosageForm) && (
          <div className="flex items-start gap-2">
            <FlaskConical className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" aria-hidden="true" />
            <span className="text-gray-900">{[m.strength, m.dosageForm].filter(Boolean).join(" • ")}</span>
          </div>
        )}
        {m.status && <p className="text-xs text-gray-700">{m.status}</p>}
        {m.alsoIn && m.alsoIn.length > 0 && (
          <p className="text-xs text-gray-700">
            <span className="font-medium text-green-800">{t("card.listedBy", { n: m.alsoIn.length + 1 })}</span>{" "}
            {t("card.also", { sources: m.alsoIn.join("; ") })}
          </p>
        )}
        {(m.kind === "ai" || m.kind === "curated") && !confirmedByData && (
          <p className="flex items-start gap-1 text-xs text-amber-900 bg-amber-50 rounded p-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {m.kind === "ai" ? t("card.aiWarning") : t("card.curatedWarning")}
          </p>
        )}

        <div className="mt-auto pt-3">
          {recordUrl && (
            <a
              href={recordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-blue-50"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              {t("card.openRecord")}
              <span className="sr-only">{t("card.openRecordSr", { brand: m.brandName })}</span>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
