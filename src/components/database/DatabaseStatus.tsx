
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, RefreshCw, BarChart3, Globe, FlaskConical } from "lucide-react";
import { localMedicineDb } from "@/utils/database/localMedicineDb";

interface DatabaseStatistics {
  count: number;
  countries: string[];
  sources: string[];
  topIngredients: string[];
}

export const DatabaseStatus = () => {
  const [localCount, setLocalCount] = useState(0);
  const [statistics, setStatistics] = useState<DatabaseStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLocalData();
  }, []);

  const loadLocalData = async () => {
    setIsLoading(true);
    try {
      const count = await localMedicineDb.getCount();
      setLocalCount(count);
      
      if (count > 0) {
        const stats = await localMedicineDb.getStatistics();
        setStatistics(stats);
      }
    } catch (error) {
      console.error("Error loading local database data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Local Database Status
        </CardTitle>
        <CardDescription>
          Current status and statistics of your local medicine database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Count */}
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{localCount.toLocaleString()}</div>
            <div className="text-sm text-blue-700 font-medium">Total Medicines</div>
          </div>
          
          {/* Countries */}
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">
              {statistics?.countries.length || 0}
            </div>
            <div className="text-sm text-green-700 font-medium">Countries</div>
          </div>
          
          {/* Sources */}
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">
              {statistics?.sources.length || 0}
            </div>
            <div className="text-sm text-purple-700 font-medium">Data Sources</div>
          </div>
          
          {/* Top Ingredients */}
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-3xl font-bold text-orange-600">
              {statistics?.topIngredients.length || 0}
            </div>
            <div className="text-sm text-orange-700 font-medium">Active Ingredients</div>
          </div>
        </div>

        {/* Detailed Statistics */}
        {statistics && localCount > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Countries List */}
            <div className="p-4 border rounded-lg">
              <h4 className="flex items-center gap-2 font-semibold text-gray-700 mb-3">
                <Globe className="w-4 h-4" />
                Countries
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {statistics.countries.slice(0, 8).map(country => (
                  <div key={country} className="text-sm text-gray-600 truncate">
                    {country}
                  </div>
                ))}
                {statistics.countries.length > 8 && (
                  <div className="text-sm text-gray-400">
                    +{statistics.countries.length - 8} more
                  </div>
                )}
              </div>
            </div>

            {/* Top Ingredients */}
            <div className="p-4 border rounded-lg">
              <h4 className="flex items-center gap-2 font-semibold text-gray-700 mb-3">
                <FlaskConical className="w-4 h-4" />
                Top Ingredients
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {statistics.topIngredients.slice(0, 6).map(ingredient => (
                  <div key={ingredient} className="text-sm text-gray-600 truncate capitalize">
                    {ingredient}
                  </div>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="p-4 border rounded-lg">
              <h4 className="flex items-center gap-2 font-semibold text-gray-700 mb-3">
                <BarChart3 className="w-4 h-4" />
                Data Sources
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {statistics.sources.map(source => (
                  <div key={source} className="text-sm text-gray-600 capitalize">
                    {source}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {localCount === 0 ? 
              "No medicines imported yet. Use the import buttons below to populate your local database." :
              "Local database is ready for offline searching."
            }
          </div>
          <Button onClick={loadLocalData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
