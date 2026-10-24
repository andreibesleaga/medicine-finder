// Outbound HTTP with a timeout and an identifying User-Agent.

export const USER_AGENT =
  "medicine-finder/2.0 (+https://github.com/andreibesleaga/medicine-finder)";

export class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/** fetch() that aborts after `timeoutMs` and throws on non-2xx responses. */
export async function fetchChecked(fetchImpl, url, { timeoutMs = 10000, headers = {}, ...init } = {}) {
  const res = await fetchImpl(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new UpstreamError(`HTTP ${res.status} from ${new URL(url).host}`, res.status);
  return res;
}

export async function fetchJson(fetchImpl, url, options) {
  const res = await fetchChecked(fetchImpl, url, { ...options, headers: { Accept: "application/json", ...options?.headers } });
  const type = res.headers.get("content-type") || "";
  if (!type.includes("json")) throw new UpstreamError(`Unexpected ${type || "content"} from ${new URL(url).host}`, res.status);
  return res.json();
}

/** Runs `fn` over `items` with at most `limit` calls in flight. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
