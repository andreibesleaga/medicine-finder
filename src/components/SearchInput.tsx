import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Database } from "lucide-react";
import { CountrySelector } from "./CountrySelector";
import { Link } from "react-router-dom";

interface SearchInputProps {
  searchTerm: string;
  onTermChange: (term: string) => void;
  selectedCountry: string;
  onCountryChange: (value: string) => void;
  isLoading: boolean;
  onSearch: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export const SearchInput = ({ searchTerm, onTermChange, selectedCountry, onCountryChange, isLoading, onSearch, onKeyDown }: SearchInputProps) => (
  <div className="max-w-4xl mx-auto mb-8">
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        <label htmlFor="ingredient" className="sr-only">
          Active ingredient
        </label>
        <Input
          id="ingredient"
          type="search"
          placeholder="Active ingredient, e.g. ibuprofen, paracetamol, amoxicillin"
          value={searchTerm}
          onChange={(e) => onTermChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isLoading}
          maxLength={80}
          autoComplete="off"
          className="h-12 text-lg px-4 border-2 border-gray-200 focus:border-blue-500 transition-colors"
        />
      </div>

      <CountrySelector value={selectedCountry} onValueChange={onCountryChange} disabled={isLoading} />

      <Button
        onClick={onSearch}
        disabled={isLoading || !searchTerm.trim()}
        size="lg"
        className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
            Searching...
          </>
        ) : (
          <>
            <Search className="w-5 h-5 mr-2" aria-hidden="true" />
            Search
          </>
        )}
      </Button>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between text-sm text-gray-600 mt-3">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>Official databases in 19 countries and the EU • open references • optional AI</span>
      </div>
      <Link to="/sources" className="text-blue-700 hover:underline">
        Data sources and their status
      </Link>
    </div>
  </div>
);
