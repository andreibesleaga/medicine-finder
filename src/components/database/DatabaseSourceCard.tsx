
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Globe, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { DatabaseSource, downloadAndImportDatabase } from "@/utils/database/databaseImporter";
import { useToast } from "@/hooks/use-toast";

interface DatabaseSourceCardProps {
  source: DatabaseSource;
  status?: 'pending' | 'downloading' | 'success' | 'error';
  isImporting: boolean;
  onImportComplete: () => void;
  onStatusChange: (sourceName: string, status: 'pending' | 'downloading' | 'success' | 'error') => void;
}

export const DatabaseSourceCard = ({ 
  source, 
  status, 
  isImporting, 
  onImportComplete, 
  onStatusChange 
}: DatabaseSourceCardProps) => {
  const { toast } = useToast();

  const handleImportSingle = async () => {
    onStatusChange(source.name, 'downloading');
    
    try {
      await downloadAndImportDatabase(source);
      onStatusChange(source.name, 'success');
      
      toast({
        title: "Import successful",
        description: `Imported data from ${source.name}`,
      });
      
      onImportComplete();
    } catch (error) {
      onStatusChange(source.name, 'error');
      
      toast({
        title: "Import failed",
        description: `Failed to import from ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status?: string) => {
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
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{source.name}</CardTitle>
          {getStatusIcon(status)}
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
            onClick={handleImportSingle}
            disabled={isImporting || status === 'downloading'}
            className="w-full"
            size="sm"
          >
            {status === 'downloading' ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : status === 'success' ? (
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
  );
};
