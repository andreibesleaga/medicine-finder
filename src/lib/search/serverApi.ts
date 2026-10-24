import type { MedicineResult, SourceKind, SourceRun } from "@/types/medicine";
import { AI_TIMEOUT_MS, API_BASE, SERVER_TIMEOUT_MS } from "./config";

export interface ServerSearchBody {
  results: Omit<MedicineResult, "id">[];
  sources: SourceRun[];
}

export interface ServerSourceInfo {
  id: string;
  name: string;
  kind: SourceKind;
  coverage: string;
  homepage: string;
  enabled: boolean;
  state: string;
  detail?: string;
  updatedAt?: string;
  rows?: number;
}

async function getJson<T>(path: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<T> {
  const res = await fetchImpl(`${API_BASE}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error("the search server is not available here");
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body as T;
}

/** Official national databases, queried by the server. */
export function searchServer(term: string, country: string | undefined, fetchImpl: typeof fetch = fetch) {
  const qs = new URLSearchParams({ q: term, ...(country ? { country } : {}) });
  return getJson<ServerSearchBody>(`/api/search?${qs}`, fetchImpl, SERVER_TIMEOUT_MS);
}

/** AI suggestions (only providers with a key on the server answer; the others report "off"). */
export function searchAi(term: string, country: string | undefined, fetchImpl: typeof fetch = fetch) {
  const qs = new URLSearchParams({ q: term, ...(country ? { country } : {}) });
  return getJson<ServerSearchBody>(`/api/ai?${qs}`, fetchImpl, AI_TIMEOUT_MS);
}

export function fetchServerSources(fetchImpl: typeof fetch = fetch) {
  return getJson<{ sources: ServerSourceInfo[] }>("/api/sources", fetchImpl, 10000);
}
