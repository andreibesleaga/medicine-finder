
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { officialDatabaseSources } from "@/utils/database/databaseImporter";
import { localMedicineDb } from "@/utils/database/localMedicineDb";
import { DatabaseStatus } from "./database/DatabaseStatus";
import { BulkImportSection } from "./database/BulkImportSection";
import { DatabaseSourceCard } from "./database/DatabaseSourceCard";
import { DatabaseNotes } from "./database/DatabaseNotes";

export const DatabaseManager = () => {
  const [importStatus, setImportStatus] = useState<Record<string, 'pending' | 'downloading' | 'success' | 'error'>>({});
  const [isImporting, setIsImporting] = useState(false);

  const handleImportComplete = async () => {
    // Trigger refresh of local count by re-rendering DatabaseStatus
    // This is handled internally by the DatabaseStatus component
  };

  const handleStatusChange = (sourceName: string, status: 'pending' | 'downloading' | 'success' | 'error') => {
    setImportStatus(prev => ({ ...prev, [sourceName]: status }));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back to Main Link */}
      <div className="mb-6">
        <Link to="/">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Main
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Medicine Database Manager</h1>
        <p className="text-gray-600">
          Download and manage official medicine databases for offline searching
        </p>
      </div>

      {/* Local Database Status */}
      <DatabaseStatus />

      {/* Bulk Import */}
      <BulkImportSection 
        onImportComplete={handleImportComplete}
        importStatus={importStatus}
        setImportStatus={setImportStatus}
      />

      {/* Individual Database Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {officialDatabaseSources.map((source) => (
          <DatabaseSourceCard
            key={source.name}
            source={source}
            status={importStatus[source.name]}
            isImporting={isImporting}
            onImportComplete={handleImportComplete}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      {/* Important Notes */}
      <DatabaseNotes />
    </div>
  );
};
