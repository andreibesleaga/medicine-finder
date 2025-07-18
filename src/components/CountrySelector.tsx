
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";
import { countries } from "@/constants/countries";

interface CountrySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export const CountrySelector = ({ value, onValueChange, disabled }: CountrySelectorProps) => {
  const allOption = countries.find(country => country.value === "all");
  const countriesOnly = countries.filter(country => !country.isRegion && country.value !== "all");

  return (
    <div className="min-w-48">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-blue-500">
          <Globe className="w-4 h-4 mr-2 text-gray-500" />
          <SelectValue placeholder="Select country" />
        </SelectTrigger>
        <SelectContent>
          {/* All Countries option */}
          {allOption && (
            <SelectItem key={allOption.value} value={allOption.value}>
              {allOption.label}
            </SelectItem>
          )}
          
          {/* Individual Countries */}
          {countriesOnly.map((country) => (
            <SelectItem key={country.value} value={country.value}>
              {country.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
