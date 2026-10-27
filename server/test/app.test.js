import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createApp } from "../app.js";
import { fixedClock } from "./helpers.js";

let dir;
let server;
let base;
const searches = [];

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "mf-dist-"));
  mkdirSync(path.join(dir, "assets"));
  mkdirSync(path.join(dir, ".well-known"));
  writeFileSync(path.join(dir, "index.html"), `<!doctype html><title>app</title>${" ".repeat(2000)}`);
  writeFileSync(path.join(dir, "assets", "app-123.js"), "console.log(1)");
  writeFileSync(path.join(dir, ".well-known", "sustainability-data"), '{"updated":"2026-10-01"}');
  mkdirSync(path.join(dir, "fhir", "StructureDefinition"), { recursive: true });
  writeFileSync(path.join(dir, "fhir", "StructureDefinition", "medicine-country.json"), '{"resourceType":"StructureDefinition"}');
  writeFileSync(path.join(path.dirname(dir), "secret.txt"), "outside");

  const handler = createApp({
    distDir: dir,
    version: "9.9.9",
    allowedOrigins: ["https://medicine-finder.vercel.app"],
    rateLimit: { limit: 3, windowMs: 60e3 },
    now: fixedClock(),
    sources: [
      { id: "ema", name: "EMA", kind: "official", coverage: "EU", homepage: "https://ema", terms: "https://ema/terms", reuse: "Name EMA", countries: ["European Union"], enabled: () => true, status: () => ({ state: "ready" }) },
    ],
    search: async (term, opts) => {
      searches.push([term, opts]);
      const results = term === "bigresult" ? Array.from({ length: 200 }, (_, i) => ({ brandName: `Brand ${i}` })) : [];
      return { term, results, sources: [] };
    },
    aiSearch: async (term) => ({ term, results: [{ brandName: "AI" }], sources: [] }),
    aiRateLimit: { limit: 1, windowMs: 60e3 },
  });
  server = http.createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
  rmSync(path.join(path.dirname(dir), "secret.txt"), { force: true });
});

const get = (p, headers = {}) => fetch(base + p, { headers });

describe("static files", () => {
  it("serves the app with security headers and a CSP", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("connect-src 'self' https://rxnav.nlm.nih.gov");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("script-src-attr 'none'");
    expect(res.headers.get("origin-agent-cluster")).toBe("?1");
    expect(res.headers.get("x-permitted-cross-domain-policies")).toBe("none");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("falls back to the app for routes but not for missing files", async () => {
    expect((await get("/sources")).status).toBe(200);
    expect(await (await get("/sources")).text()).toContain("<title>app</title>");
    expect((await get("/assets/missing.js")).status).toBe(404);
    expect((await get("/_vercel/insights/script.js")).status).toBe(404);
    expect((await get("/.well-known/other")).status).toBe(404);
  });

  it("caches hashed assets for a year", async () => {
    const res = await get("/assets/app-123.js");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  });

  it("compresses large text files", async () => {
    const raw = await new Promise((resolve) => {
      http.get(base + "/", { headers: { "Accept-Encoding": "gzip" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ enc: res.headers["content-encoding"], body: Buffer.concat(chunks) }));
      });
    });
    expect(raw.enc).toBe("gzip");
    expect(gunzipSync(raw.body).toString()).toContain("<title>app</title>");
  });

  it("serves the sustainability declaration with its media type", async () => {
    const res = await get("/.well-known/sustainability-data");
    expect(res.headers.get("content-type")).toBe("application/sustainability-data+json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("does not serve files outside dist", async () => {
    const res = await new Promise((resolve) => {
      http.get({ host: "127.0.0.1", port: new URL(base).port, path: "/../secret.txt" }, resolve);
    });
    // path.normalize already clamps "/../" to "/"; the dist-folder check stays as a second guard
    expect(res.statusCode).toBe(404);
    expect((await get("/%2e%2e/secret.txt")).status).toBe(404);
  });

  it("answers 400 to a request-target that is not a valid URL, and keeps running", async () => {
    const res = await new Promise((resolve) => {
      http.get({ host: "127.0.0.1", port: new URL(base).port, path: "//[" }, resolve);
    });
    expect(res.statusCode).toBe(400);
    expect((await get("/api/health")).status).toBe(200);
  });

  it("rejects other methods", async () => {
    expect((await fetch(base + "/", { method: "POST" })).status).toBe(405);
  });
});

describe("FHIR definitions", () => {
  it("answers an extension's canonical URL with its definition, readable from anywhere", async () => {
    const res = await get("/fhir/StructureDefinition/medicine-country");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/fhir+json; charset=utf-8");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ resourceType: "StructureDefinition" });
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect((await get("/fhir/StructureDefinition/unknown")).status).toBe(404);
    // a name with dots or slashes is not a definition: it ends at the app page, never a file outside
    const odd = await get("/fhir/StructureDefinition/..%2F..%2Fsecret");
    expect(odd.headers.get("content-type")).not.toContain("fhir");
    expect(await odd.text()).not.toContain("outside");
  });
});

describe("api", () => {
  it("reports health and sources", async () => {
    expect(await (await get("/api/health")).json()).toEqual({ status: "ok", version: "9.9.9", uptimeSec: 0 });
    const { sources } = await (await get("/api/sources")).json();
    expect(sources).toEqual([
      { id: "ema", name: "EMA", kind: "official", coverage: "EU", homepage: "https://ema", terms: "https://ema/terms", reuse: "Name EMA", countries: ["European Union"], enabled: true, state: "ready" },
    ]);
  });

  it("validates the search term and country", async () => {
    expect((await get("/api/search?q=%3Cb%3E")).status).toBe(400);
    expect((await get("/api/search")).status).toBe(400);
    expect((await get("/api/search?q=ibuprofen&country=%3Cx%3E")).status).toBe(400);
    expect((await get("/api/nothing")).status).toBe(404);
  });

  it("searches, then rate-limits per client", async () => {
    const ok = await get("/api/search?q=ibuprofen&country=Italy", { "X-Forwarded-For": "203.0.113.9" });
    expect(ok.status).toBe(200);
    expect(searches.at(-1)).toEqual(["ibuprofen", { country: "Italy" }]);
    await get("/api/search?q=ibuprofen&country=all", { "X-Forwarded-For": "203.0.113.9" });
    expect(searches.at(-1)).toEqual(["ibuprofen", { country: undefined }]);
    await get("/api/search?q=ibuprofen", { "X-Forwarded-For": "203.0.113.9" });
    const limited = await get("/api/search?q=ibuprofen", { "X-Forwarded-For": "203.0.113.9" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("80");
    expect((await get("/api/search?q=ibuprofen", { "X-Forwarded-For": "198.51.100.1" })).status).toBe(200);
  });

  it("lets browsers keep a search answer briefly and answers 304 to a matching ETag", async () => {
    const h = { "X-Real-IP": "192.0.2.70" };
    const first = await get("/api/search?q=etagtest", h);
    expect(first.headers.get("cache-control")).toBe("public, max-age=60, stale-while-revalidate=300");
    expect(first.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^W\/"/);
    const again = await get("/api/search?q=etagtest", { ...h, "If-None-Match": etag });
    // (a cached copy of the same answer has the same ETag: the "cached" flag is not part of it)
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
    // errors are never kept
    expect((await get("/api/search?q=%3Cb%3E", h)).headers.get("cache-control")).toBe("no-store");
  });

  it("keeps AI answers only in the visitor's browser and the source list briefly", async () => {
    const ai = await get("/api/ai?q=cachecheck", { "X-Real-IP": "192.0.2.90" });
    expect(ai.headers.get("cache-control")).toBe("private, max-age=300");
    expect((await get("/api/sources")).headers.get("cache-control")).toBe("public, max-age=30");
    expect((await get("/api/health")).headers.get("cache-control")).toBe("no-store");
  });

  it("refuses HEAD on the search endpoints (a search costs upstream calls)", async () => {
    const res = await fetch(base + "/api/search?q=ibuprofen", { method: "HEAD", headers: { "X-Real-IP": "192.0.2.71" } });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
  });

  it("keys the limit on X-Real-IP, so a forged X-Forwarded-For does not get round it", async () => {
    const one = { "X-Real-IP": "192.0.2.80" };
    for (let i = 0; i < 3; i++) await get(`/api/search?q=forged&n=${i}`, { ...one, "X-Forwarded-For": `10.0.0.${i}` });
    expect((await get("/api/search?q=forged", { ...one, "X-Forwarded-For": "10.0.0.99" })).status).toBe(429);
  });

  it("compresses large search answers", async () => {
    const raw = await new Promise((resolve) => {
      http.get(base + "/api/search?q=bigresult", { headers: { "Accept-Encoding": "gzip", "X-Forwarded-For": "192.0.2.50" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ enc: res.headers["content-encoding"], vary: res.headers.vary, body: Buffer.concat(chunks) }));
      });
    });
    expect(raw.enc).toBe("gzip");
    expect(raw.vary).toBe("Accept-Encoding");
    expect(JSON.parse(gunzipSync(raw.body).toString()).results).toHaveLength(200);
  });

  it("serves AI suggestions on their own endpoint with their own limit", async () => {
    const res = await get("/api/ai?q=ibuprofen", { "X-Forwarded-For": "192.0.2.7" });
    expect((await res.json()).results).toEqual([{ brandName: "AI" }]);
    expect((await get("/api/ai?q=ibuprofen", { "X-Forwarded-For": "192.0.2.7" })).status).toBe(429);
    expect((await get("/api/search?q=ibuprofen", { "X-Forwarded-For": "192.0.2.7" })).status).toBe(200);
    expect((await get("/api/ai?q=%3C")).status).toBe(400);
  });

  it("allows cross-origin calls only from configured origins", async () => {
    const allowed = await get("/api/health", { Origin: "https://medicine-finder.vercel.app" });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://medicine-finder.vercel.app");
    const other = await get("/api/health", { Origin: "https://evil.example" });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
    const pre = await fetch(base + "/api/search", { method: "OPTIONS", headers: { Origin: "https://medicine-finder.vercel.app" } });
    expect(pre.status).toBe(204);
  });
});

describe("global limit", () => {
  it("caps all visitors together, whatever address they claim", async () => {
    const handler = createApp({
      distDir: "/nonexistent",
      version: "1",
      sources: [],
      search: async (term) => ({ term, results: [], sources: [] }),
      aiSearch: async (term) => ({ term, results: [], sources: [] }),
      rateLimit: { limit: 100, windowMs: 60e3 },
      globalRateLimit: { limit: 2, windowMs: 60e3 },
      now: fixedClock(),
    });
    const srv = http.createServer(handler);
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${srv.address().port}/api/search?q=ibuprofen`;
    const codes = [];
    for (const ip of ["192.0.2.1", "192.0.2.2", "192.0.2.3"]) codes.push((await fetch(url, { headers: { "X-Real-IP": ip } })).status);
    await new Promise((r) => srv.close(r));
    expect(codes).toEqual([200, 200, 429]);
  });
});

describe("ETag of a cached copy", () => {
  it("is the same for the fresh answer and its cached copy, so the browser's first revalidation gets 304", async () => {
    let calls = 0;
    const handler = createApp({
      distDir: "/nonexistent",
      version: "1",
      sources: [],
      search: async (term) => ({ term, results: [{ brandName: "Advil" }], sources: [], ...(calls++ ? { cached: true } : {}) }),
      aiSearch: async (term) => ({ term, results: [], sources: [] }),
      now: fixedClock(),
    });
    const srv = http.createServer(handler);
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${srv.address().port}/api/search?q=ibuprofen`;
    const fresh = await fetch(url, { headers: { "X-Real-IP": "192.0.2.9" } });
    const etag = fresh.headers.get("etag");
    const revalidated = await fetch(url, { headers: { "X-Real-IP": "192.0.2.9", "If-None-Match": etag } });
    await new Promise((r) => srv.close(r));
    expect(revalidated.status).toBe(304);
  });
});
