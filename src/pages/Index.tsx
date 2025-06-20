
import { useState } from "react";
import { SearchInput } from "@/components/SearchInput";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { SearchProgressComponent } from "@/components/SearchProgress";
import { MedicineResult } from "@/types/medicine";

const Index = () => {
  const [results, setResults] = useState<MedicineResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (term: string, searchResults: MedicineResult[]) => {
    setSearchTerm(term);
    setResults(searchResults);
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
  };

  const handleReset = () => {
    setSearchTerm("");
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Medicine Brand Finder
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Search for active drug ingredients and discover brand names worldwide with APIs, official databases, RxNorm data, and AI enhanced global coverage
          </p>
        </div>

        {/* Search Input */}
        <SearchInput 
          onSearch={handleSearch} 
          onLoadingChange={handleLoadingChange}
        />

        {/* Search Progress */}
        <SearchProgressComponent isSearching={isLoading} />

        {/* Results Dashboard */}
        <ResultsDashboard 
          results={results} 
          isLoading={isLoading} 
          searchTerm={searchTerm}
          onReset={handleReset}
        />
      </div>
    </div>
  );
};

export default Index;
