import { useRef, useState } from "react";
import type { SearchOutcome, SourceRun } from "@/types/medicine";
import { addAiSuggestions, searchMedicines } from "@/lib/search/searchMedicines";
import { cacheKey, readCached, saveCached } from "@/lib/search/resultCache";
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
  // a newer search makes the AI answer of an older one irrelevant
  const searchId = useRef(0);
  const { toast } = useToast();

  /** `fresh` skips this browser's saved results. */
  const handleSearch = async (fresh = false) => {
    const term = searchTerm.trim().replace(/\s+/g, " ").toLowerCase();
    if (term.length < 2) {
      toast({ title: "Search term required", description: "Enter an active ingredient, for example ibuprofen.", variant: "destructive" });
      return;
    }
    const id = ++searchId.current;
    const selection = selectedCountry === "all" ? undefined : selectedCountry;
    const key = cacheKey(term, selection);

    if (!fresh) {
      const saved = await readCached(key);
      if (saved) {
        onResult(saved);
        return;
      }
    }

    setIsLoading(true);
    onLoadingChange(true);
    let outcome: SearchOutcome;
    try {
      outcome = await searchMedicines(term, selection, onProgress);
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Unknown error. Please try again.",
        variant: "destructive",
      });
      return;
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
    if (id !== searchId.current) return;
    onResult(outcome);
    if (outcome.results.length === 0 && !outcome.aiPending) {
      toast({ title: "No results found", description: `Nothing found for "${term}". Check the spelling or use the international (INN) name.` });
    }
    if (outcome.aiPending) {
      const withAi = await addAiSuggestions(outcome);
      if (id !== searchId.current) return;
      onResult(withAi);
      outcome = withAi;
    }
    void saveCached(key, outcome);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && searchTerm.trim()) handleSearch();
  };

  return { searchTerm, setSearchTerm, selectedCountry, setSelectedCountry, isLoading, handleSearch, handleKeyDown };
};
