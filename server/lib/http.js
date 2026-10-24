// Outbound HTTP with a timeout and an identifying User-Agent.

export const USER_AGENT = "medicine-finder (+https://github.com/andreibesleaga/medicine-finder)";

export class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/** Hides anything that looks like an API key ("sk-…", "AIza…") in a provider's message. */
export const redactKeys = (text) => String(text).replace(/\b(sk-|AIza)[\w*.-]+/g, "[key]");

/** fetch() that aborts after `timeoutMs` and throws on non-2xx responses. */
export async function fetchChecked(fetchImpl, url, { timeoutMs = 10000, headers = {}, ...init } = {}) {
  const res = await fetchImpl(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    // include the provider's own short error message when it sends one (never the request). Not for
    // key, billing or permission errors: those can quote part of the key and are shown to visitors.
    let reason = "";
    if (![401, 402, 403].includes(res.status)) {
      try {
        const msg = JSON.parse(await res.text())?.error?.message;
        if (typeof msg === "string") reason = `: ${redactKeys(msg).replace(/\s+/g, " ").slice(0, 120)}`;
      } catch {
        // not JSON; the status is enough
      }
    }
    throw new UpstreamError(`HTTP ${res.status} from ${new URL(url).host}${reason}`, res.status);
  }
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
