
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, Database, Globe, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { officialDatabaseSources, downloadAndImportDatabase, importAllDatabases } from "@/utils/database/databaseImporter";
import { localMedicineDb } from "@/utils/database/localMedicineDb";
import { useToast } from "@/hooks/use-toast";

export const DatabaseManager = () => {
  const [localCount, setLocalCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<Record<string, 'pending' | 'downloading' | 'success' | 'error'>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadLocalCount();
  }, []);

  const loadLocalCount = async () => {
    try {
      const count = await localMedicineDb.getCount();
      setLocalCount(count);
    } catch (error) {
      console.error("Error loading local database count:", error);
    }
  };

  const handleImportSingle = async (sourceIndex: number) => {
    const source = officialDatabaseSources[sourceIndex];
    
    setImportStatus(prev => ({ ...prev, [source.name]: 'downloading' }));
    
    try {
      await downloadAndImportDatabase(source);
      setImportStatus(prev => ({ ...prev, [source.name]: 'success' }));
      
      toast({
        title: "Import successful",
        description: `Imported data from ${source.name}`,
      });
      
      await loadLocalCount();
    } catch (error) {
      setImportStatus(prev => ({ ...prev, [source.name]: 'error' }));
      
      toast({
        title: "Import failed",
        description: `Failed to import from ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

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
      
      await loadLocalCount();
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'downloading':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Medicine Database Manager</h1>
        <p className="text-gray-600">
          Download and manage official medicine databases for offline searching
        </p>
      </div>

      {/* Local Database Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Local Database Status
          </CardTitle>
          <CardDescription>
            Current status of your local medicine database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-600">{localCount.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Medicines stored locally</div>
            </div>
            <Button onClick={loadLocalCount} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Import */}
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

      {/* Individual Database Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {officialDatabaseSources.map((source, index) => (
          <Card key={source.name} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{source.name}</CardTitle>
                {getStatusIcon(importStatus[source.name])}
              </div>
              <CardDescription>{source.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{source.country}</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{source.format.toUpperCase()}</Badge>
                </div>
                
                <Button 
                  onClick={() => handleImportSingle(index)}
                  disabled={isImporting || importStatus[source.name] === 'downloading'}
                  className="w-full"
                  size="sm"
                >
                  {importStatus[source.name] === 'downloading' ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : importStatus[source.name] === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Imported
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Important Notes */}
      <Card className="mt-8 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-800">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-yellow-700 space-y-2">
          <p>• Database downloads may be blocked by browser CORS policies. In production, these should be proxied through a backend service.</p>
          <p>• Some databases require registration or API keys for full access.</p>
          <p>• Local storage uses IndexedDB and is limited by browser storage quotas.</p>
          <p>• Database formats and URLs may change - verify official sources for the latest information.</p>
        </CardContent>
      </Card>
    </div>
  );
};
