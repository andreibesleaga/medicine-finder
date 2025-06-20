
// Simple in-memory cache for API results
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedResult = (key: string): any | null => {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

export const setCachedResult = (key: string, data: any): void => {
  searchCache.set(key, { data, timestamp: Date.now() });
};

export const clearCache = (): void => {
  searchCache.clear();
};
