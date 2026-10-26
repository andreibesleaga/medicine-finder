
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";
import { countries } from "@/constants/countries";

interface CountrySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** countries with official data; listed first when known */
  withData?: string[];
}

export const CountrySelector = ({ value, onValueChange, disabled, withData }: CountrySelectorProps) => {
  const allOption = countries.find(country => country.value === "all");
  const regions = countries.filter(country => country.isRegion);
  const countriesOnly = countries.filter(country => !country.isRegion && country.value !== "all");
  const data = new Set(withData ?? []);
  const official = countriesOnly.filter((c) => data.has(c.value));
  const others = data.size ? countriesOnly.filter((c) => !data.has(c.value)) : countriesOnly;

  return (
    <div className="min-w-48">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger aria-label="Country" className="h-12 border-2 border-gray-200 focus:border-blue-500">
          <Globe className="w-4 h-4 mr-2 text-gray-500" aria-hidden="true" />
          <SelectValue placeholder="Select country" />
        </SelectTrigger>
        <SelectContent>
          {/* All Countries option */}
          {allOption && (
            <SelectItem key={allOption.value} value={allOption.value}>
              {allOption.label}
            </SelectItem>
          )}

          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Regions</SelectLabel>
            {regions.map((region) => (
              <SelectItem key={region.value} value={region.value}>
                {region.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          {official.length > 0 && (
            <>
              <SelectGroup>
                <SelectLabel>Countries with official data ({official.length})</SelectLabel>
                {official.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {/* the United Kingdom's official data covers Northern Ireland only (EMA Article 57) */}
                    {country.value === "United Kingdom" ? `${country.label} (Northern Ireland data)` : country.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            <SelectLabel>{official.length > 0 ? "Other countries (open references and AI only)" : "Countries"}</SelectLabel>
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
