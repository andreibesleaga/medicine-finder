
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Database } from "lucide-react";
import { MedicineResult } from "@/types/medicine";
import { useSearchMedicine } from "@/hooks/useSearchMedicine";
import { CountrySelector } from "./CountrySelector";
import { Link } from "react-router-dom";

interface SearchInputProps {
  onSearch: (term: string, results: MedicineResult[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

export const SearchInput = ({ onSearch, onLoadingChange }: SearchInputProps) => {
  const {
    searchTerm,
    setSearchTerm,
    selectedCountry,
    setSelectedCountry,
    isLoading,
    handleSearch,
    handleKeyPress
  } = useSearchMedicine({ onSearch, onLoadingChange });

  return (
    <div className="max-w-4xl mx-auto mb-8">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Enter active drug ingredient (e.g., acetaminophen, ibuprofen, aspirin)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="h-12 text-lg px-4 border-2 border-gray-200 focus:border-blue-500 transition-colors"
          />
        </div>
        
        <CountrySelector 
          value={selectedCountry}
          onValueChange={setSelectedCountry}
          disabled={isLoading}
        />
        
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
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between text-sm text-gray-500 mt-3">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <Database className="w-4 h-4 text-blue-500" />
          <span>Local & Global databases • AI enhanced • Real-time</span>
        </div>
        <Link to="/database">
          <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-6">
            <Database className="w-3 h-3 mr-1" />
            Manage Local Databases
          </Button>
        </Link>
      </div>
    </div>
  );
};
