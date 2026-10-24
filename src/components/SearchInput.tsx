import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Database } from "lucide-react";
import type { SearchOutcome, SourceRun } from "@/types/medicine";
import { useSearchMedicine } from "@/hooks/useSearchMedicine";
import { CountrySelector } from "./CountrySelector";
import { Link } from "react-router-dom";

interface SearchInputProps {
  onResult: (outcome: SearchOutcome) => void;
  onLoadingChange: (loading: boolean) => void;
  onProgress: (sources: SourceRun[]) => void;
}

export const SearchInput = ({ onResult, onLoadingChange, onProgress }: SearchInputProps) => {
  const { searchTerm, setSearchTerm, selectedCountry, setSelectedCountry, isLoading, handleSearch, handleKeyDown } =
    useSearchMedicine({ onResult, onLoadingChange, onProgress });

  return (
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
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            maxLength={80}
            autoComplete="off"
            className="h-12 text-lg px-4 border-2 border-gray-200 focus:border-blue-500 transition-colors"
          />
        </div>

        <CountrySelector value={selectedCountry} onValueChange={setSelectedCountry} disabled={isLoading} />

        <Button
          onClick={handleSearch}
          disabled={isLoading || !searchTerm.trim()}
          size="lg"
          className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-5 h-5 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between text-sm text-gray-600 mt-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <span>Official databases (EU, France, Spain, Canada, US) • open references • optional AI</span>
        </div>
        <Link to="/sources" className="text-blue-700 hover:underline">
          Data sources and their status
        </Link>
      </div>
    </div>
  );
};
