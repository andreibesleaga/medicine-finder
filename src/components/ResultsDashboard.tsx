
import { MedicineResult } from "@/types/medicine";
import { MedicineCard } from "./MedicineCard";
import { Loader2, Package, Globe } from "lucide-react";

interface ResultsDashboardProps {
  results: MedicineResult[];
  isLoading: boolean;
  searchTerm: string;
}

export const ResultsDashboard = ({ results, isLoading, searchTerm }: ResultsDashboardProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Searching Medicine Database</h3>
        <p className="text-gray-500 text-center max-w-md">
          Querying RxNorm API and enhancing results with AI to find all brand names containing "{searchTerm}"
        </p>
      </div>
    );
  }

  if (!searchTerm && results.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
          <Package className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Ready to Search</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Enter an active drug ingredient above to discover brand names and equivalents from around the world
        </p>
      </div>
    );
  }

  if (results.length === 0 && searchTerm) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
          <Globe className="w-10 h-10 text-yellow-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Results Found</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          No medicines found containing "{searchTerm}". Try searching with a different active ingredient name.
        </p>
      </div>
    );
  }

  const uniqueCountries = [...new Set(results.map(r => r.country))].length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Results Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Search Results for "{searchTerm}"
            </h2>
            <p className="text-gray-600">
              Found {results.length} brand names across {uniqueCountries} countries
            </p>
          </div>
          <div className="text-right">
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
