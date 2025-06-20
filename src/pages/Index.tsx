
import { useState } from "react";
import { SearchInput } from "@/components/SearchInput";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { SearchProgressComponent } from "@/components/SearchProgress";
import { MedicineResult } from "@/types/medicine";
import { Button } from "@/components/ui/button";
import { Database, Heart } from "lucide-react";
import { Link } from "react-router-dom";

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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Medicine Brand Finder
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Search for active drug ingredients and discover brand names worldwide with official databases, RxNorm data, and AI-enhanced global coverage
          </p>
          
          <div className="flex justify-center">
            <Link to="/database">
              <Button variant="outline" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Manage Local Databases
              </Button>
            </Link>
          </div>
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
        />
      </div>

      {/* Footer */}
      <footer className="py-6 bg-white/50 backdrop-blur-sm border-t border-gray-200">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 flex items-center justify-center gap-1">
            made with <Heart className="w-4 h-4 text-red-500 fill-current" /> by Andrei Besleaga Nicolae
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
