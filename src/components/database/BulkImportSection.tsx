
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw } from "lucide-react";
import { officialDatabaseSources, downloadAndImportDatabase } from "@/utils/database/databaseImporter";
import { useToast } from "@/hooks/use-toast";

interface BulkImportSectionProps {
  onImportComplete: () => void;
  importStatus: Record<string, 'pending' | 'downloading' | 'success' | 'error'>;
  setImportStatus: React.Dispatch<React.SetStateAction<Record<string, 'pending' | 'downloading' | 'success' | 'error'>>>;
}

export const BulkImportSection = ({ onImportComplete, importStatus, setImportStatus }: BulkImportSectionProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const { toast } = useToast();

  const handleImportAll = async () => {
    setIsImporting(true);
    setImportProgress(0);
    
    // Reset status for all sources
    const initialStatus: Record<string, 'pending' | 'downloading' | 'success' | 'error'> = {};
    officialDatabaseSources.forEach(source => {
      initialStatus[source.name] = 'pending';
    });
    setImportStatus(initialStatus);

    try {
      let completed = 0;
      
      for (const source of officialDatabaseSources) {
        setImportStatus(prev => ({ ...prev, [source.name]: 'downloading' }));
        
        try {
          await downloadAndImportDatabase(source);
          setImportStatus(prev => ({ ...prev, [source.name]: 'success' }));
        } catch (error) {
          setImportStatus(prev => ({ ...prev, [source.name]: 'error' }));
          console.error(`Failed to import ${source.name}:`, error);
        }
        
        completed++;
        setImportProgress((completed / officialDatabaseSources.length) * 100);
      }
      
      toast({
        title: "Bulk import completed",
        description: "All available databases have been processed",
      });
      
      onImportComplete();
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Bulk Database Import</CardTitle>
        <CardDescription>
          Import all available official medicine databases at once
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isImporting && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Import Progress</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}
          
          <Button 
            onClick={handleImportAll} 
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Importing Databases...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Import All Databases
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
