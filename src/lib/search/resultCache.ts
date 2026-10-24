// Keeps the last searches in this browser (IndexedDB) for a day, so repeating a search is
// instant and works offline. Storage can be unavailable (private windows, blocked site data);
// every call then quietly does nothing.

import type { SearchOutcome } from "@/types/medicine";

const DB_NAME = "medicine-finder";
const STORE = "searches";
export const MAX_ENTRIES = 50;
export const MAX_AGE_MS = 24 * 3600e3;

interface Entry {
  key: string;
  savedAt: number;
  outcome: SearchOutcome;
}

export const cacheKey = (term: string, selection?: string) => `${term.trim().toLowerCase()}|${selection ?? "all"}`;

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" }).createIndex("savedAt", "savedAt");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });

/** A saved outcome younger than a day, or null. */
export async function readCached(key: string, now = Date.now()): Promise<SearchOutcome | null> {
  const db = await open();
  if (!db) return null;
  try {
    const entry = await new Promise<Entry | undefined>((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as Entry | undefined);
      req.onerror = () => resolve(undefined);
    });
    if (!entry || now - entry.savedAt > MAX_AGE_MS) return null;
    return { ...entry.outcome, savedAt: entry.savedAt };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Saves a finished outcome and keeps only the newest MAX_ENTRIES. */
export async function saveCached(key: string, outcome: SearchOutcome, now = Date.now()): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const { savedAt: _ignored, aiPending: _pending, ...clean } = outcome;
    store.put({ key, savedAt: now, outcome: clean } satisfies Entry);
    const keys = store.index("savedAt").getAllKeys();
    keys.onsuccess = () => {
      const all = keys.result as IDBValidKey[];
      // ordered by savedAt, oldest first, and already including the entry just written
      for (const k of all.slice(0, Math.max(0, all.length - MAX_ENTRIES))) store.delete(k);
    };
    await done(tx);
  } catch {
    // storage full or blocked: the search still works without the cache
  } finally {
    db.close();
  }
}
