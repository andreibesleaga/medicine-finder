
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, RefreshCw } from "lucide-react";
import { localMedicineDb } from "@/utils/database/localMedicineDb";

export const DatabaseStatus = () => {
  const [localCount, setLocalCount] = useState(0);

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

  return (
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
  );
};
