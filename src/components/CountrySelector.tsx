import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";
import { countries } from "@/constants/countries";
import { useI18n } from "@/i18n";

interface CountrySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** countries with official data; listed first when known */
  withData?: string[];
}

export const CountrySelector = ({ value, onValueChange, disabled, withData }: CountrySelectorProps) => {
  const { t, lang, countryName } = useI18n();
  const regions = countries.filter((country) => country.isRegion);
  // country names in the page's language, in its alphabetical order
  const countriesOnly = countries
    .filter((country) => !country.isRegion && country.value !== "all")
    .map((c) => ({ value: c.value, label: countryName(c.value) }))
    .sort((a, b) => a.label.localeCompare(b.label, lang));
  const data = new Set(withData ?? []);
  const official = countriesOnly.filter((c) => data.has(c.value));
  const others = data.size ? countriesOnly.filter((c) => !data.has(c.value)) : countriesOnly;
  // the United Kingdom's official data covers Northern Ireland only (EMA Article 57)
  const officialLabel = (c: { value: string; label: string }) => (c.value === "United Kingdom" ? t("country.niOnly", { country: c.label }) : c.label);

  return (
    <div className="min-w-48">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger aria-label={t("country.label")} className="h-12 border-2 border-gray-200 focus:border-blue-500">
          <Globe className="w-4 h-4 mr-2 text-gray-500" aria-hidden="true" />
          <SelectValue placeholder={t("country.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("country.all")}</SelectItem>

          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{t("country.regions")}</SelectLabel>
            {regions.map((region) => (
              <SelectItem key={region.value} value={region.value}>
                {/* the flag or globe stays; the name is translated */}
                {`${region.label.match(/^\P{L}+/u)?.[0] ?? ""}${t(`region.${region.value.slice("region:".length)}`)}`}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          {official.length > 0 && (
            <>
              <SelectGroup>
                <SelectLabel>{t("country.withData", { n: official.length })}</SelectLabel>
                {official.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {officialLabel(country)}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            <SelectLabel>{official.length > 0 ? t("country.others") : t("country.countries")}</SelectLabel>
            {others.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
