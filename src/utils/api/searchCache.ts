
// Simple in-memory cache for API results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCachedResult = (key: string): any | null => {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setCachedResult = (key: string, data: any): void => {
  searchCache.set(key, { data, timestamp: Date.now() });
};

export const clearCache = (): void => {
  searchCache.clear();
};
