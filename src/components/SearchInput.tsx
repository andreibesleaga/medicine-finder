
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
  { value: "Afghanistan", label: "Afghanistan" },
  { value: "Albania", label: "Albania" },
  { value: "Algeria", label: "Algeria" },
  { value: "Argentina", label: "Argentina" },
  { value: "Armenia", label: "Armenia" },
  { value: "Australia", label: "Australia" },
  { value: "Austria", label: "Austria" },
  { value: "Azerbaijan", label: "Azerbaijan" },
  { value: "Bahrain", label: "Bahrain" },
  { value: "Bangladesh", label: "Bangladesh" },
  { value: "Belarus", label: "Belarus" },
  { value: "Belgium", label: "Belgium" },
  { value: "Bolivia", label: "Bolivia" },
  { value: "Bosnia and Herzegovina", label: "Bosnia and Herzegovina" },
  { value: "Brazil", label: "Brazil" },
  { value: "Bulgaria", label: "Bulgaria" },
  { value: "Cambodia", label: "Cambodia" },
  { value: "Canada", label: "Canada" },
  { value: "Chile", label: "Chile" },
  { value: "China", label: "China" },
  { value: "Colombia", label: "Colombia" },
  { value: "Costa Rica", label: "Costa Rica" },
  { value: "Croatia", label: "Croatia" },
  { value: "Czech Republic", label: "Czech Republic" },
  { value: "Denmark", label: "Denmark" },
  { value: "Dominican Republic", label: "Dominican Republic" },
  { value: "Ecuador", label: "Ecuador" },
  { value: "Egypt", label: "Egypt" },
  { value: "Estonia", label: "Estonia" },
  { value: "Ethiopia", label: "Ethiopia" },
  { value: "Finland", label: "Finland" },
  { value: "France", label: "France" },
  { value: "Georgia", label: "Georgia" },
  { value: "Germany", label: "Germany" },
  { value: "Ghana", label: "Ghana" },
  { value: "Greece", label: "Greece" },
  { value: "Guatemala", label: "Guatemala" },
  { value: "Hungary", label: "Hungary" },
  { value: "Iceland", label: "Iceland" },
  { value: "India", label: "India" },
  { value: "Indonesia", label: "Indonesia" },
  { value: "Iran", label: "Iran" },
  { value: "Iraq", label: "Iraq" },
  { value: "Ireland", label: "Ireland" },
  { value: "Israel", label: "Israel" },
  { value: "Italy", label: "Italy" },
  { value: "Jamaica", label: "Jamaica" },
  { value: "Japan", label: "Japan" },
  { value: "Jordan", label: "Jordan" },
  { value: "Kazakhstan", label: "Kazakhstan" },
  { value: "Kenya", label: "Kenya" },
  { value: "Kuwait", label: "Kuwait" },
  { value: "Latvia", label: "Latvia" },
  { value: "Lebanon", label: "Lebanon" },
  { value: "Lithuania", label: "Lithuania" },
  { value: "Luxembourg", label: "Luxembourg" },
  { value: "Malaysia", label: "Malaysia" },
  { value: "Malta", label: "Malta" },
  { value: "Mexico", label: "Mexico" },
  { value: "Morocco", label: "Morocco" },
  { value: "Netherlands", label: "Netherlands" },
  { value: "New Zealand", label: "New Zealand" },
  { value: "Nigeria", label: "Nigeria" },
  { value: "Norway", label: "Norway" },
  { value: "Pakistan", label: "Pakistan" },
  { value: "Panama", label: "Panama" },
  { value: "Peru", label: "Peru" },
  { value: "Philippines", label: "Philippines" },
  { value: "Poland", label: "Poland" },
  { value: "Portugal", label: "Portugal" },
  { value: "Qatar", label: "Qatar" },
  { value: "Romania", label: "Romania" },
  { value: "Russia", label: "Russia" },
  { value: "Saudi Arabia", label: "Saudi Arabia" },
  { value: "Serbia", label: "Serbia" },
  { value: "Singapore", label: "Singapore" },
  { value: "Slovakia", label: "Slovakia" },
  { value: "Slovenia", label: "Slovenia" },
  { value: "South Africa", label: "South Africa" },
  { value: "South Korea", label: "South Korea" },
  { value: "Spain", label: "Spain" },
  { value: "Sri Lanka", label: "Sri Lanka" },
  { value: "Sweden", label: "Sweden" },
  { value: "Switzerland", label: "Switzerland" },
  { value: "Taiwan", label: "Taiwan" },
  { value: "Thailand", label: "Thailand" },
  { value: "Turkey", label: "Turkey" },
  { value: "Ukraine", label: "Ukraine" },
  { value: "United Arab Emirates", label: "UAE" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "United States", label: "United States" },
  { value: "Uruguay", label: "Uruguay" },
  { value: "Venezuela", label: "Venezuela" },
  { value: "Vietnam", label: "Vietnam" }
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
