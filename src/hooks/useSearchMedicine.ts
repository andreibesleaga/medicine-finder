
import { useState } from "react";
import { MedicineResult } from "@/types/medicine";
import { searchMedicines } from "@/utils/medicineApi";
import { useToast } from "@/hooks/use-toast";

interface UseSearchMedicineProps {
  onSearch: (term: string, results: MedicineResult[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

export const useSearchMedicine = ({ onSearch, onLoadingChange }: UseSearchMedicineProps) => {
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
      
      // Show different messages based on results
      if (results.length === 0) {
        toast({
          title: "No results found",
          description: `No medicines found for "${cleanTerm}" ${countryText}. Try a different search term or check spelling.`,
          variant: "destructive",
        });
      } else if (results.length < 5) {
        toast({
          title: "Limited results",
          description: `Found ${results.length} medicine brands from ${uniqueCountries} countries for "${cleanTerm}" ${countryText} (${searchTime}ms)`,
        });
      } else {
        toast({
          title: "Search successful",
          description: `Found ${results.length} medicine brands from ${uniqueCountries} countries for "${cleanTerm}" ${countryText} (${searchTime}ms)`,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: `Unable to search for medicines: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        variant: "destructive",
      });
      
      // Still call onSearch with empty results to clear previous results
      onSearch(searchTerm, []);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && searchTerm.trim()) {
      handleSearch();
    }
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedCountry,
    setSelectedCountry,
    isLoading,
    handleSearch,
    handleKeyPress
  };
};
