// Helpers shared by the dataset loaders.

import { fetchChecked } from "../lib/http.js";

export const DAY_MS = 24 * 3600e3;

// the largest official file today is about 70 MB; anything far bigger is a wrong or broken answer
export const MAX_DOWNLOAD_BYTES = 300 * 1024 * 1024;

/** Downloads a file and returns it as a Buffer, refusing files over `MAX_DOWNLOAD_BYTES`. */
export async function downloadBuffer(fetchImpl, url, timeoutMs = 10 * 60e3, maxBytes = MAX_DOWNLOAD_BYTES) {
  const res = await fetchChecked(fetchImpl, url, { timeoutMs });
  const tooBig = () => new Error(`${new URL(url).host}: file larger than ${Math.round(maxBytes / 1048576)} MB`);
  if (Number(res.headers?.get?.("content-length")) > maxBytes) throw tooBig();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw tooBig();
  return buf;
}

/** Downloads a file and returns it as text in the given encoding. Big national files can be slow. */
export async function downloadText(fetchImpl, url, encoding = "utf-8", timeoutMs = 10 * 60e3) {
  return new TextDecoder(encoding).decode(await downloadBuffer(fetchImpl, url, timeoutMs));
}

/** Joins several substance names: ["A", "B"] -> "A + B". */
export const joinSubstances = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))].join(" + ");
