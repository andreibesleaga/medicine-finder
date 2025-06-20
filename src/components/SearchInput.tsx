
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { searchMedicines } from "@/utils/medicineApi";
import { MedicineResult } from "@/types/medicine";
import { useToast } from "@/hooks/use-toast";

interface SearchInputProps {
  onSearch: (term: string, results: MedicineResult[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

export const SearchInput = ({ onSearch, onLoadingChange }: SearchInputProps) => {
  const [searchTerm, setSearchTerm] = useState("");
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

    console.log("Starting search for:", searchTerm);
    setIsLoading(true);
    onLoadingChange(true);

    try {
      const results = await searchMedicines(searchTerm.trim());
      console.log("Search completed, found results:", results.length);
      
      onSearch(searchTerm, results);
      
      toast({
        title: "Search completed",
        description: `Found ${results.length} medicine brands containing "${searchTerm}"`,
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
    <div className="max-w-2xl mx-auto mb-8">
      <div className="flex gap-3">
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
      <p className="text-sm text-gray-500 mt-2 text-center">
        Search for generic drug names to find brand equivalents worldwide
      </p>
    </div>
  );
};
