
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const DatabaseNotes = () => {
  return (
    <Card className="mt-8 border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-yellow-800">Important Notes (experimental only)</CardTitle>
      </CardHeader>
      <CardContent className="text-yellow-700 space-y-2">
        <p>• This feature is to be implemented with back-end technologies on real production deployments</p>
        <p>• Local storage uses hardcoded data to IndexedDB and is limited by browser storage quotas.</p>
        <p>• Database downloads may be blocked by browser CORS policies. In production, these should be proxied through a backend service.</p>
        <p>• Some databases require registration or API keys for full access.</p>
        <p>• Database formats and URLs may change - verify official sources for the latest information.</p>
      </CardContent>
    </Card>
  );
};
