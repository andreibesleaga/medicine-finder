
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Globe, Database } from "lucide-react";
import { searchMedicines } from "@/utils/medicineApi";
import { MedicineResult } from "@/types/medicine";
import { useToast } from "@/hooks/use-toast";

interface SearchInputProps {
  onSearch: (term: string, results: MedicineResult[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

const countries = [
  { value: "all", label: "All Countries" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Germany", label: "Germany" },
  { value: "France", label: "France" },
  { value: "Canada", label: "Canada" },
  { value: "Australia", label: "Australia" },
  { value: "Japan", label: "Japan" },
  { value: "India", label: "India" },
  { value: "Brazil", label: "Brazil" },
  { value: "China", label: "China" },
  { value: "Italy", label: "Italy" },
  { value: "Spain", label: "Spain" },
  { value: "Netherlands", label: "Netherlands" },
  { value: "Switzerland", label: "Switzerland" },
  { value: "Sweden", label: "Sweden" },
  { value: "Norway", label: "Norway" },
  { value: "Denmark", label: "Denmark" },
  { value: "Belgium", label: "Belgium" },
  { value: "Austria", label: "Austria" },
  { value: "South Korea", label: "South Korea" },
  { value: "Mexico", label: "Mexico" },
  { value: "Argentina", label: "Argentina" },
  { value: "South Africa", label: "South Africa" },
  { value: "Russia", label: "Russia" },
  { value: "Poland", label: "Poland" },
  { value: "Turkey", label: "Turkey" },
  { value: "Israel", label: "Israel" },
  { value: "Singapore", label: "Singapore" },
  { value: "New Zealand", label: "New Zealand" }
];

export const SearchInput = ({ onSearch, onLoadingChange }: SearchInputProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search term required",
        description: "Please enter an active drug ingredient to search for.",
        variant: "destructive",
      });
      return;
    }

    const cleanTerm = searchTerm.trim().toLowerCase();
    console.log("Starting optimized search for:", cleanTerm, "in country:", selectedCountry);
    
    setIsLoading(true);
    onLoadingChange(true);

    try {
      const startTime = Date.now();
      
      const results = await searchMedicines(
        cleanTerm, 
        selectedCountry === "all" ? undefined : selectedCountry
      );
      
      const searchTime = Date.now() - startTime;
      console.log(`Search completed in ${searchTime}ms, found ${results.length} results`);
      
      onSearch(searchTerm, results);
      
      const countryText = selectedCountry === "all" ? "worldwide" : `in ${selectedCountry}`;
      const uniqueCountries = new Set(results.map(r => r.country)).size;
      
      toast({
        title: "Search completed",
        description: `Found ${results.length} medicine brands from ${uniqueCountries} countries containing "${cleanTerm}" ${countryText} (${searchTime}ms)`,
      });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: `Unable to search for medicines: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch();
    }
  };

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
        
        <div className="min-w-48">
          <Select value={selectedCountry} onValueChange={setSelectedCountry} disabled={isLoading}>
            <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-blue-500">
              <Globe className="w-4 h-4 mr-2 text-gray-500" />
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
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
      
      <div className="flex flex-col sm:flex-row gap-2 text-sm text-gray-500 mt-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-500" />
          <span>Local + Global databases • AI enhanced • Real-time results</span>
        </div>
      </div>
    </div>
  );
};
