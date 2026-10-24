/**
 * Where the /api server lives. Empty means the same origin (the Railway deployment).
 * A static deployment elsewhere (for example Vercel) sets VITE_API_BASE to the Railway URL.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export const BROWSER_TIMEOUT_MS = 12000;
export const SERVER_TIMEOUT_MS = 45000;
export const AI_TIMEOUT_MS = 60000;
