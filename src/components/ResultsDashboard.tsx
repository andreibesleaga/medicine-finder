
import { MedicineResult } from "@/types/medicine";
import { MedicineCard } from "./MedicineCard";
import { Loader2, Package, Globe, Database, Brain } from "lucide-react";

interface ResultsDashboardProps {
  results: MedicineResult[];
  isLoading: boolean;
  searchTerm: string;
}

export const ResultsDashboard = ({ results, isLoading, searchTerm }: ResultsDashboardProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Searching Medicine Database</h3>
        <p className="text-gray-500 text-center max-w-md mb-4">
          Querying RxNorm API and AI engines worldwide to find all brand names containing "{searchTerm}"
        </p>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>RxNorm API</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span>AI Engines</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span>Global Sources</span>
          </div>
        </div>
      </div>
    );
  }

  if (!searchTerm && results.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
          <Package className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Ready to Search</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-4">
          Enter an active drug ingredient above to discover brand names and equivalents from around the world
        </p>
        <div className="flex justify-center items-center gap-6 text-sm text-gray-400 mb-6">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            <span>RxNorm Database</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            <span>AI Enhanced</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-500" />
            <span>Global Coverage</span>
          </div>
        </div>
        <div className="text-center mt-16">
          <p className="text-gray-600 flex items-center justify-center gap-2">
            made with 
            <img 
              src="https://lovable.dev/favicon.ico" 
              alt="Lovable" 
              className="w-4 h-4" 
            /> 
            by Andrei Besleaga Nicolae
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0 && searchTerm) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
          <Globe className="w-10 h-10 text-yellow-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Results Found</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          No medicines found containing "{searchTerm}". Try searching with a different active ingredient name or adjust the country filter.
        </p>
      </div>
    );
  }

  const uniqueCountries = [...new Set(results.map(r => r.country))].length;
  const rxNormCount = results.filter(r => r.source === 'rxnorm').length;
  const aiCount = results.filter(r => r.source === 'ai').length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Results Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Search Results for "{searchTerm}"
            </h2>
            <p className="text-gray-600 mb-3">
              Found {results.length} brand names across {uniqueCountries} countries
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <Database className="w-4 h-4" />
                <span>{rxNormCount} from RxNorm</span>
              </div>
              <div className="flex items-center gap-2 text-purple-600">
                <Brain className="w-4 h-4" />
                <span>{aiCount} from AI sources</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <Globe className="w-4 h-4" />
                <span>{uniqueCountries} countries</span>
              </div>
            </div>
          </div>
          <div className="text-center lg:text-right">
            <div className="text-3xl font-bold text-blue-600">{results.length}</div>
            <div className="text-sm text-gray-500">Total Results</div>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((result) => (
          <MedicineCard key={result.id} medicine={result} />
        ))}
      </div>
    </div>
  );
};
