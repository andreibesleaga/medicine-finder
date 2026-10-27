// HTTP handler: the /api endpoints plus the built single-page app from dist/.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompressSync, gzip, gzipSync, constants as zlib } from "node:zlib";
import { TtlCache } from "./lib/cache.js";
import { validateTerm } from "./lib/text.js";
import { RateLimiter, clientKey } from "./lib/rateLimit.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Browser-side sources the page calls directly; everything else goes through /api.
export const BROWSER_SOURCES = [
  "https://rxnav.nlm.nih.gov",
  "https://api.fda.gov",
  "https://query.wikidata.org",
  "https://clinicaltrials.gov",
  "https://pubchem.ncbi.nlm.nih.gov",
];

export function contentSecurityPolicy(extraConnect = []) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${[...BROWSER_SOURCES, ...extraConnect].join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=31536000",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "X-Permitted-Cross-Domain-Policies": "none",
  // pages and their files are for this site only; /api and the well-known file are read by others
  "Cross-Origin-Resource-Policy": "same-origin",
};
const SHARED_RESOURCE = { "Cross-Origin-Resource-Policy": "cross-origin" };

// how long browsers may keep an answer (no CDN in front): official data briefly and shared, AI
// suggestions only in the visitor's own browser; errors never
const API_CACHE = {
  "/api/search": "public, max-age=60, stale-while-revalidate=300",
  "/api/ai": "private, max-age=300",
  "/api/sources": "public, max-age=30",
};
const gzipAsync = promisify(gzip);
const etagOf = (body) => `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 22)}"`;

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;

export function createApp({
  distDir,
  search,
  aiSearch,
  sources,
  version,
  allowedOrigins = [],
  rateLimit = { limit: 20, windowMs: 60e3 },
  aiRateLimit = { limit: 10, windowMs: 60e3 },
  // all visitors together: a cap that forged client addresses cannot get round
  globalRateLimit = { limit: 300, windowMs: 60e3 },
  globalAiRateLimit = { limit: 60, windowMs: 60e3 },
  onSearch = () => {},
  // false where no proxy sets X-Real-IP or X-Forwarded-For: then a visitor's own header is ignored
  trustForwardedFor = true,
  now = Date.now,
  log = () => {},
}) {
  const limiter = new RateLimiter({ ...rateLimit, now });
  const aiLimiter = new RateLimiter({ ...aiRateLimit, now });
  const globalLimiter = new RateLimiter({ ...globalRateLimit, now });
  const globalAiLimiter = new RateLimiter({ ...globalAiRateLimit, now });
  // compressed answers by ETag, so a popular answer is compressed once
  const gzipped = new TtlCache({ ttlMs: 3600e3, maxEntries: 500, maxBytes: 32 * 1024 * 1024, sizeOf: (b) => b.length, now });
  const fileCache = new Map();
  const startedAt = now();
  const csp = contentSecurityPolicy();

  function send(res, status, body, headers = {}) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(res.req.method === "HEAD" ? undefined : body);
  }

  /**
   * A JSON answer. `cacheControl` (only for 200 answers) lets browsers keep it; such answers carry a
   * weak ETag and a matching If-None-Match gets 304 without a body.
   */
  async function sendJson(res, status, data, headers = {}, cacheControl = null) {
    const body = JSON.stringify(data);
    const vary = [headers.Vary, "Accept-Encoding"].filter(Boolean).join(", ");
    const cacheable = status === 200 && cacheControl;
    // the ETag ignores the "cached" flag, so a fresh and a cached copy of one answer match
    const etag = cacheable ? etagOf(JSON.stringify({ ...data, cached: undefined })) : null;
    const h = {
      "Content-Type": MIME[".json"],
      ...SHARED_RESOURCE,
      ...headers,
      "Cache-Control": cacheable ? cacheControl : "no-store",
      ...(etag ? { ETag: etag } : {}),
      Vary: vary,
    };
    if (etag && String(res.req.headers["if-none-match"] || "").split(/\s*,\s*/).includes(etag)) {
      return send(res, 304, undefined, h);
    }
    // search answers are a few hundred KB; gzip makes them about ten times smaller
    if (body.length > 1024 && /\bgzip\b/.test(res.req.headers["accept-encoding"] || "")) {
      let zipped = etag ? gzipped.get(etag) : undefined;
      if (!zipped) {
        zipped = await gzipAsync(body, { level: 6 });
        if (etag) gzipped.set(etag, zipped);
      }
      return send(res, status, zipped, { ...h, "Content-Encoding": "gzip" });
    }
    send(res, status, body, h);
  }

  function corsHeaders(req) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "600", Vary: "Origin" };
    }
    return {};
  }

  async function handleApi(req, res, url) {
    const cors = corsHeaders(req);
    if (req.method === "OPTIONS") return send(res, 204, undefined, cors);
    if (url.pathname === "/api/health") {
      return sendJson(res, 200, { status: "ok", version, uptimeSec: Math.round((now() - startedAt) / 1000) }, cors);
    }
    if (url.pathname === "/api/sources") {
      const list = sources.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        coverage: s.coverage,
        homepage: s.homepage,
        terms: s.terms,
        ...(s.reuse ? { reuse: s.reuse } : {}),
        ...(s.countries ? { countries: s.countries } : {}),
        enabled: s.enabled(),
        ...s.status(),
      }));
      return sendJson(res, 200, { sources: list }, cors, API_CACHE["/api/sources"]);
    }
    // /api/search: official databases (fast); /api/ai: AI suggestions (slow, separately limited)
    if (url.pathname === "/api/search" || url.pathname === "/api/ai") {
      // a search costs upstream calls: GET only, so HEAD cannot run one without being counted as such
      if (req.method === "HEAD") return send(res, 405, "Method not allowed", { Allow: "GET", "Content-Type": MIME[".txt"], ...cors });
      const term = validateTerm(url.searchParams.get("q"));
      if (!term) return sendJson(res, 400, { error: "Give an ingredient name of 2 to 80 letters, digits or spaces in ?q=" }, cors);
      const countryRaw = (url.searchParams.get("country") || "").trim();
      const country = countryRaw && countryRaw !== "all" ? validateTerm(countryRaw) : null;
      if (countryRaw && countryRaw !== "all" && !country) return sendJson(res, 400, { error: "Invalid country" }, cors);
      const isAi = url.pathname === "/api/ai";
      const quota = (isAi ? aiLimiter : limiter).take(clientKey(req, { trustForwardedFor }));
      const overall = quota.ok ? (isAi ? globalAiLimiter : globalLimiter).take("all") : quota;
      if (!quota.ok || !overall.ok) {
        const wait = Math.max(quota.retryAfterSec, overall.retryAfterSec);
        return sendJson(res, 429, { error: "Too many searches; try again shortly" }, { ...cors, "Retry-After": String(wait) });
      }
      if (!isAi) {
        try {
          onSearch(term, country);
        } catch (err) {
          // counting is for the daily warm-up only; a failure must not stop the search
          log(`counting a search failed: ${err instanceof Error ? err.message : err}`);
        }
      }
      const body = await (isAi ? aiSearch : search)(term, { country: country || undefined });
      return sendJson(res, 200, body, { ...cors, "X-RateLimit-Remaining": String(quota.remaining) }, API_CACHE[url.pathname]);
    }
    return sendJson(res, 404, { error: "Not found" }, cors);
  }

  async function loadFile(filePath) {
    const cached = fileCache.get(filePath);
    if (cached) return cached;
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) return null;
    const data = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const entry = { data, type, br: null, gzip: null };
    if (COMPRESSIBLE.test(type) && data.length > 1024) {
      entry.br = brotliCompressSync(data, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } });
      entry.gzip = gzipSync(data, { level: 9 });
    }
    fileCache.set(filePath, entry);
    return entry;
  }

  function sendFile(req, res, entry, headers) {
    const accept = String(req.headers["accept-encoding"] || "");
    const h = { "Content-Type": entry.type, Vary: "Accept-Encoding", ...headers };
    if (entry.br && /\bbr\b/.test(accept)) return send(res, 200, entry.br, { ...h, "Content-Encoding": "br" });
    if (entry.gzip && /\bgzip\b/.test(accept)) return send(res, 200, entry.gzip, { ...h, "Content-Encoding": "gzip" });
    return send(res, 200, entry.data, h);
  }

  async function handleStatic(req, res, url) {
    let rel;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, "Bad request", { "Content-Type": MIME[".txt"] });
    }
    const filePath = path.join(distDir, path.normalize(rel));
    if (!filePath.startsWith(distDir + path.sep) && filePath !== distDir) return send(res, 404, "Not found", { "Content-Type": MIME[".txt"] });

    // FHIR extension definitions answer at their canonical URL (no ".json"), for FHIR tools
    const fhirDef = /^\/fhir\/StructureDefinition\/[a-z0-9-]+$/.exec(rel);
    if (fhirDef) {
      const entry = await loadFile(`${filePath}.json`);
      if (!entry) return send(res, 404, "Not found", { "Content-Type": MIME[".txt"] });
      return sendFile(req, res, { ...entry, type: "application/fhir+json; charset=utf-8" }, {
        ...SHARED_RESOURCE,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      });
    }

    if (rel === "/.well-known/sustainability-data") {
      const entry = await loadFile(filePath);
      if (!entry) return send(res, 404, "Not found", { "Content-Type": MIME[".txt"] });
      return sendFile(req, res, { ...entry, type: "application/sustainability-data+json" }, {
        ...SHARED_RESOURCE,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      });
    }

    const entry = rel.endsWith("/") ? null : await loadFile(filePath);
    if (entry) {
      const immutable = rel.startsWith("/assets/");
      return sendFile(req, res, entry, {
        "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
        ...(entry.type.startsWith("text/html") ? { "Content-Security-Policy": csp, "Cache-Control": "no-cache" } : {}),
      });
    }
    // unknown files (and anything under /assets or /.well-known) are real 404s; other paths are app routes
    if (path.extname(rel) || rel.startsWith("/assets/") || rel.startsWith("/.well-known/")) {
      return send(res, 404, "Not found", { "Content-Type": MIME[".txt"], "Cache-Control": "no-cache" });
    }
    const index = await loadFile(path.join(distDir, "index.html"));
    if (!index) return send(res, 503, "The app has not been built (run npm run build)", { "Content-Type": MIME[".txt"] });
    return sendFile(req, res, index, { "Cache-Control": "no-cache", "Content-Security-Policy": csp });
  }

  return async function handler(req, res) {
    const started = now();
    let url;
    try {
      url = new URL(req.url || "/", "http://localhost");
    } catch {
      // a request-target such as "//[" is not a valid URL
      return send(res, 400, "Bad request", { "Content-Type": MIME[".txt"] });
    }
    try {
      const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
      if (!["GET", "HEAD"].includes(req.method) && !(isApi && req.method === "OPTIONS")) {
        return send(res, 405, "Method not allowed", { Allow: "GET, HEAD", "Content-Type": MIME[".txt"] });
      }
      if (isApi) return await handleApi(req, res, url);
      return await handleStatic(req, res, url);
    } catch (err) {
      log(`error ${req.method} ${url.pathname}: ${err instanceof Error ? err.stack : err}`);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal error" });
      else res.end();
    } finally {
      if (url.pathname.startsWith("/api/")) log(`${req.method} ${url.pathname} ${res.statusCode} ${now() - started}ms`);
    }
  };
}
