
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Globe } from "lucide-react";
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
  { value: "Canada", label: "Canada" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Germany", label: "Germany" },
  { value: "France", label: "France" },
  { value: "Australia", label: "Australia" },
  { value: "India", label: "India" },
  { value: "Brazil", label: "Brazil" },
  { value: "Italy", label: "Italy" },
  { value: "Spain", label: "Spain" },
  { value: "Mexico", label: "Mexico" },
  { value: "South Africa", label: "South Africa" },
  { value: "Pakistan", label: "Pakistan" },
  { value: "Thailand", label: "Thailand" },
  { value: "Egypt", label: "Egypt" },
  { value: "United Arab Emirates", label: "UAE" }
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

    console.log("Starting search for:", searchTerm, "in country:", selectedCountry);
    setIsLoading(true);
    onLoadingChange(true);

    try {
      const results = await searchMedicines(
        searchTerm.trim(), 
        selectedCountry === "all" ? undefined : selectedCountry
      );
      console.log("Search completed, found results:", results.length);
      
      onSearch(searchTerm, results);
      
      const countryText = selectedCountry === "all" ? "worldwide" : `in ${selectedCountry}`;
      toast({
        title: "Search completed",
        description: `Found ${results.length} medicine brands containing "${searchTerm}" ${countryText}`,
      });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: "Unable to search for medicines. Please try again.",
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
        <p>Search for generic drug names to find brand equivalents worldwide</p>
        <span className="hidden sm:inline">•</span>
        <p>Enhanced with AI for global coverage beyond RxNorm database</p>
      </div>
    </div>
  );
};
