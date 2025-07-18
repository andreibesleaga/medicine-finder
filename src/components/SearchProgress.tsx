
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { searchProgressTracker, SearchProgress } from "@/utils/api/searchProgressTracker";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface SearchProgressProps {
  isSearching: boolean;
}

export const SearchProgressComponent = ({ isSearching }: SearchProgressProps) => {
  const [progress, setProgress] = useState<SearchProgress>({
    total: 0,
    completed: 0,
    currentApi: '',
    errors: []
  });

  useEffect(() => {
    const unsubscribe = searchProgressTracker.onProgress(setProgress);
    
    if (!isSearching) {
      searchProgressTracker.reset();
    }
    
    return () => {
      // Note: This is a simplified cleanup - in a real app you'd want proper unsubscription
    };
  }, [isSearching]);

  if (!isSearching || progress.total === 0) {
    return null;
  }

  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto mb-6 p-4 bg-white rounded-lg border border-gray-200">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Searching APIs ({progress.completed}/{progress.total})
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        
        <Progress value={progressPercentage} className="h-2" />
        
        {progress.currentApi && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Querying {progress.currentApi}...</span>
          </div>
        )}
        
        {progress.errors.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span>Some APIs encountered issues:</span>
            </div>
            <div className="text-xs text-gray-500 pl-6">
              {progress.errors.slice(0, 3).map((error, index) => (
                <div key={index}>{error}</div>
              ))}
              {progress.errors.length > 3 && (
                <div>... and {progress.errors.length - 3} more</div>
              )}
            </div>
          </div>
        )}
        
        {progress.completed === progress.total && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>Search completed!</span>
          </div>
        )}
      </div>
    </div>
  );
};
