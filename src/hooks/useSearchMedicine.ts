import { useRef, useState } from "react";
import type { SearchOutcome, SourceRun } from "@/types/medicine";
import { addAiSuggestions, searchMedicines } from "@/lib/search/searchMedicines";
import { cacheKey, readCached, saveCached } from "@/lib/search/resultCache";
import { useToast } from "@/hooks/use-toast";

interface UseSearchMedicineProps {
  onResult: (outcome: SearchOutcome) => void;
  onLoadingChange: (loading: boolean) => void;
  onProgress: (sources: SourceRun[]) => void;
  /** called when a search starts, with the cleaned term and the country or region ("all" for none) */
  onSearchStart?: (term: string, country: string) => void;
}

export const useSearchMedicine = ({ onResult, onLoadingChange, onProgress, onSearchStart }: UseSearchMedicineProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  // a newer search makes the AI answer of an older one irrelevant
  const searchId = useRef(0);
  const { toast } = useToast();

  /** `fresh` skips this browser's saved results; `from` searches a term and country given by a link. */
  const handleSearch = async (fresh = false, from?: { term: string; country: string }) => {
    if (from) {
      setSearchTerm(from.term);
      setSelectedCountry(from.country);
    }
    const term = (from?.term ?? searchTerm).trim().replace(/\s+/g, " ").toLowerCase();
    const country = from?.country ?? selectedCountry;
    if (term.length < 2) {
      toast({ title: "Search term required", description: "Enter an active ingredient or a brand name, for example ibuprofen or Nurofen.", variant: "destructive" });
      return;
    }
    const id = ++searchId.current;
    const selection = country === "all" ? undefined : country;
    onSearchStart?.(term, country);
    const key = cacheKey(term, selection);

    if (!fresh) {
      const saved = await readCached(key);
      if (id !== searchId.current) return;
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
      toast({ title: "No results found", description: `Nothing found for "${term}". Check the spelling or use the active ingredient.` });
    }
    if (outcome.aiPending) {
      const withAi = await addAiSuggestions(outcome);
      if (id !== searchId.current) return;
      onResult(withAi);
      outcome = withAi;
    }
    // an answer with a failed or unreachable source is not kept: the next search tries again
    if (!outcome.sources.some((s) => s.state === "error" || s.state === "unavailable")) void saveCached(key, outcome);
  };

  /** Forgets the running search, so a late AI answer does not bring its results back. */
  const reset = () => {
    searchId.current += 1;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && searchTerm.trim()) handleSearch();
  };

  return { searchTerm, setSearchTerm, selectedCountry, setSelectedCountry, isLoading, handleSearch, handleKeyDown, reset };
};
