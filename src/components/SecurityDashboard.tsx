
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Key, Activity } from "lucide-react";
import { SecureApiWrapper } from "@/utils/api/secureApiWrapper";
import { SECURITY_CONFIG } from "@/utils/security/securityConfig";

export const SecurityDashboard = () => {
  const [securityLog, setSecurityLog] = useState<any[]>([]);
  const [apiStatus, setApiStatus] = useState<Record<string, any>>({});

  useEffect(() => {
    // Load security log
    const log = JSON.parse(localStorage.getItem('security-log') || '[]');
    setSecurityLog(log.slice(-10)); // Show last 10 events

    // Get API status
    setApiStatus(SecureApiWrapper.getApiStatus());
  }, []);

  const clearSecurityLog = () => {
    localStorage.removeItem('security-log');
    setSecurityLog([]);
  };

  const isSecureApiAvailable = SecureApiWrapper.isSecureApiAvailable();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
          <CardDescription>
            Current security configuration and API status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">API Security</h4>
              <div className="flex items-center gap-2">
                {isSecureApiAvailable ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <Shield className="h-3 w-3 mr-1" />
                    Secure
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Insecure
                  </Badge>
                )}
                <span className="text-sm text-gray-600">
                  {isSecureApiAvailable ? 'Using Supabase Edge Functions' : 'API keys exposed in frontend'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Rate Limiting</h4>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-100 text-blue-800">
                  <Activity className="h-3 w-3 mr-1" />
                  Active
                </Badge>
                <span className="text-sm text-gray-600">
                  {SECURITY_CONFIG.RATE_LIMITS.perMinute} requests/minute
                </span>
              </div>
            </div>
          </div>

          {!isSecureApiAvailable && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Security Warning</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    API keys are currently stored in the frontend code, which is insecure. 
                    Connect to Supabase to move API calls to secure Edge Functions.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Services Status
          </CardTitle>
          <CardDescription>
            Status of external API integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(apiStatus).map(([service, status]) => (
              <div key={service} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium capitalize">{service}</span>
                <div className="flex gap-2">
                  <Badge variant={status.available ? "default" : "secondary"}>
                    {status.available ? "Available" : "Unavailable"}
                  </Badge>
                  <Badge variant={status.secure ? "default" : "destructive"}>
                    {status.secure ? "Secure" : "Insecure"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Security Events
            </span>
            <Button variant="outline" size="sm" onClick={clearSecurityLog}>
              Clear Log
            </Button>
          </CardTitle>
          <CardDescription>
            Recent security-related events and API access attempts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {securityLog.length === 0 ? (
            <p className="text-sm text-gray-500">No security events recorded</p>
          ) : (
            <div className="space-y-2">
              {securityLog.map((event, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{event.event}</span>
                      <Badge variant="outline" className="text-xs">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </Badge>
                    </div>
                    {event.details && (
                      <pre className="text-xs text-gray-600 mt-1 overflow-x-auto">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
