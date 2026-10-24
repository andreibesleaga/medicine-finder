import { useState } from "react";
import type { SearchOutcome, SourceRun } from "@/types/medicine";
import { searchMedicines } from "@/lib/search/searchMedicines";
import { useToast } from "@/hooks/use-toast";

interface UseSearchMedicineProps {
  onResult: (outcome: SearchOutcome) => void;
  onLoadingChange: (loading: boolean) => void;
  onProgress: (sources: SourceRun[]) => void;
}

export const useSearchMedicine = ({ onResult, onLoadingChange, onProgress }: UseSearchMedicineProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    const term = searchTerm.trim().replace(/\s+/g, " ");
    if (term.length < 2) {
      toast({
        title: "Search term required",
        description: "Enter an active ingredient, for example ibuprofen.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    onLoadingChange(true);
    try {
      const country = selectedCountry === "all" ? undefined : selectedCountry;
      const outcome = await searchMedicines(term.toLowerCase(), country, onProgress);
      onResult(outcome);
      if (outcome.results.length === 0) {
        toast({
          title: "No results found",
          description: `Nothing found for "${term}"${country ? ` in ${country}` : ""}. Check the spelling or use the international (INN) name.`,
        });
      }
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Unknown error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && searchTerm.trim()) handleSearch();
  };

  return { searchTerm, setSearchTerm, selectedCountry, setSelectedCountry, isLoading, handleSearch, handleKeyDown };
};
