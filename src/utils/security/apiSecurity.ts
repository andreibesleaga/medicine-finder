import { SECURITY_CONFIG } from './securityConfig';

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// API request validation and security
export class ApiSecurity {
  private static getClientId(): string {
    // Generate a simple client identifier
    let clientId = localStorage.getItem('client-id');
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem('client-id', clientId);
    }
    return clientId;
  }

  static checkRateLimit(endpoint: string): boolean {
    const clientId = this.getClientId();
    const key = `${clientId}-${endpoint}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (current.count >= SECURITY_CONFIG.RATE_LIMITS.perMinute) {
      console.warn(`Rate limit exceeded for ${endpoint}`);
      return false;
    }

    current.count++;
    return true;
  }

  static sanitizeApiResponse(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
    const cleaned = { ...data };

    const cleanObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(cleanObject);
      }
      
      if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const keyLower = key.toLowerCase();
          if (!sensitiveFields.some(field => keyLower.includes(field))) {
            result[key] = cleanObject(value);
          }
        }
        return result;
      }
      
      return obj;
    };

    return cleanObject(cleaned);
  }

  static async secureApiRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const endpoint = new URL(url).hostname;
    
    // Check rate limit
    if (!this.checkRateLimit(endpoint)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Add security headers
    const secureHeaders = {
      ...SECURITY_CONFIG.HEADERS,
      'User-Agent': 'Medicine-Finder/1.0',
      'Accept': 'application/json',
      ...options.headers
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        headers: secureHeaders,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  static validateApiKey(apiKey: string, service: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      console.warn(`Invalid API key format for ${service}`);
      return false;
    }

    // Basic format validation
    if (apiKey.length < 10) {
      console.warn(`API key too short for ${service}`);
      return false;
    }

    return true;
  }

  static logSecurityEvent(event: string, details: any): void {
    const timestamp = new Date().toISOString();
    console.warn(`[Security Event] ${timestamp}: ${event}`, details);
    
    // In production, this would send to a logging service
    // For now, we'll store critical events in localStorage
    const securityLog = JSON.parse(localStorage.getItem('security-log') || '[]');
    securityLog.push({ timestamp, event, details });
    
    // Keep only last 100 events
    if (securityLog.length > 100) {
      securityLog.shift();
    }
    
    localStorage.setItem('security-log', JSON.stringify(securityLog));
  }
}

// Enhanced API key rotation mechanism
export class ApiKeyManager {
  private static readonly KEY_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  static shouldRotateKey(service: string): boolean {
    const lastRotation = localStorage.getItem(`${service}-key-rotation`);
    if (!lastRotation) return false;

    const rotationTime = parseInt(lastRotation);
    return Date.now() - rotationTime > this.KEY_ROTATION_INTERVAL;
  }

  static markKeyRotated(service: string): void {
    localStorage.setItem(`${service}-key-rotation`, Date.now().toString());
  }

  static getSecureApiKey(service: string): string | null {
    // In a secure implementation, this would fetch from Supabase Edge Functions
    // For now, we'll return null to force backend implementation
    ApiSecurity.logSecurityEvent('API_KEY_ACCESS_ATTEMPT', { service });
    
    console.warn(`API key access for ${service} - should be handled by backend`);
    return null;
  }
}
