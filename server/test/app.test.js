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
  writeFileSync(path.join(path.dirname(dir), "secret.txt"), "outside");

  const handler = createApp({
    distDir: dir,
    version: "9.9.9",
    allowedOrigins: ["https://medicine-finder.vercel.app"],
    rateLimit: { limit: 3, windowMs: 60e3 },
    now: fixedClock(),
    sources: [{ id: "ema", name: "EMA", kind: "official", coverage: "EU", homepage: "https://ema", enabled: () => true, status: () => ({ state: "ready" }) }],
    search: async (term, opts) => {
      searches.push([term, opts]);
      return { term, results: [], sources: [] };
    },
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
    expect(res.statusCode).not.toBe(200);
    expect((await get("/%2e%2e/secret.txt")).status).toBe(404);
  });

  it("rejects other methods", async () => {
    expect((await fetch(base + "/", { method: "POST" })).status).toBe(405);
  });
});

describe("api", () => {
  it("reports health and sources", async () => {
    expect(await (await get("/api/health")).json()).toEqual({ status: "ok", version: "9.9.9", uptimeSec: 0 });
    const { sources } = await (await get("/api/sources")).json();
    expect(sources).toEqual([{ id: "ema", name: "EMA", kind: "official", coverage: "EU", homepage: "https://ema", enabled: true, state: "ready" }]);
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
    expect(limited.headers.get("retry-after")).toBe("60");
    expect((await get("/api/search?q=ibuprofen", { "X-Forwarded-For": "198.51.100.1" })).status).toBe(200);
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
