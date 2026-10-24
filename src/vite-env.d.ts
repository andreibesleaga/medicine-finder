/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** base URL of the /api server; empty = same origin */
  readonly VITE_API_BASE?: string;
  /** "true" loads Vercel Web Analytics (only useful when deployed on Vercel) */
  readonly VITE_VERCEL_ANALYTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
