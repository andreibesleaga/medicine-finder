// The documents that state how many countries have official data must agree with the datasets.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DATASETS } from "../datasets/index.js";
import { createCimaSource } from "../sources/cima.js";

const root = new URL("../../", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8");

describe("coverage in the documents", () => {
  const countries = new Set([...DATASETS, createCimaSource({ fetch, env: {} })].filter((s) => s.kind === "official").flatMap((s) => s.countries ?? []));
  countries.delete("European Union");
  const n = countries.size;

  it("the datasets whose terms set a condition carry it into downloads", () => {
    const reuse = Object.fromEntries(DATASETS.map((d) => [d.id, d.reuse]));
    expect(reuse["malta-ma"]).toMatch(/not for commercial/i);
    expect(reuse.invima).toMatch(/CC BY-SA/);
    expect(reuse["ema-article57"]).toMatch(/European Medicines Agency/);
    expect(reuse.ema).toMatch(/European Medicines Agency/);
  });

  it("every official source names the countries it covers", () => {
    for (const d of DATASETS.filter((x) => x.kind === "official")) expect(d.countries?.length, d.id).toBeGreaterThan(0);
  });

  it.each(["README.md", "index.html", "public/llms.txt"])("%s states the same number of countries", (file) => {
    expect(read(file)).toContain(`EU and ${n} countries`);
  });
});
