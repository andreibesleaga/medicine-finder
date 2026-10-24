import { describe, it, expect } from "vitest";
import { createAiSources, parseBrandList, buildMessages } from "../sources/ai.js";
import { stubFetch, jsonResponse } from "./helpers.js";

const answer = (content) => jsonResponse({ choices: [{ message: { content } }] });

describe("AI answer parsing", () => {
  it("reads a JSON array inside fences or prose", () => {
    const text = 'Here you go:\n```json\n[{"brandName":"Advil","country":"United States","manufacturer":"Haleon"}]\n```';
    expect(parseBrandList(text)).toEqual([{ brandName: "Advil", country: "United States", manufacturer: "Haleon" }]);
  });

  it("drops malformed items and caps the list", () => {
    const items = [{ brandName: "" }, { name: "x" }, ...Array.from({ length: 12 }, (_, i) => ({ brandName: `B${i}` }))];
    const out = parseBrandList(JSON.stringify(items));
    expect(out).toHaveLength(10);
    expect(out[0]).toEqual({ brandName: "B0", country: "Not stated", manufacturer: undefined });
  });

  it("returns nothing for non-JSON answers", () => {
    expect(parseBrandList("I am not sure.")).toEqual([]);
    expect(parseBrandList("[not json]")).toEqual([]);
    expect(parseBrandList(undefined)).toEqual([]);
  });

  it("puts the ingredient and country in the prompt", () => {
    expect(buildMessages("ibuprofen", "Italy")[1].content).toContain('"ibuprofen" marketed in Italy');
  });
});

describe("AI providers", () => {
  it("are enabled only when their key is set", () => {
    const sources = createAiSources({ fetch: stubFetch([]), env: { DEEPSEEK_API_KEY: "k" } });
    expect(sources.map((s) => [s.id, s.enabled()])).toEqual([
      ["ai-openai", false],
      ["ai-perplexity", false],
      ["ai-deepseek", true],
      ["ai-openrouter", false],
    ]);
    expect(sources[0].status()).toEqual({ state: "disabled", detail: "set OPENAI_API_KEY to enable" });
  });

  it("sends the key server-side and maps the answer", async () => {
    const fetch = stubFetch([["openrouter.ai", () => answer('[{"brandName":"Nurofen","country":"United Kingdom"}]')]]);
    const [, , , openrouter] = createAiSources({ fetch, env: { OPENROUTER_API_KEY: "secret" } });
    const rows = await openrouter.search("ibuprofen", { country: "United Kingdom" });
    expect(rows).toEqual([{ brandName: "Nurofen", activeIngredient: "ibuprofen", country: "United Kingdom", manufacturer: undefined }]);
    const { init } = fetch.calls[0];
    expect(init.headers.Authorization).toBe("Bearer secret");
    const body = JSON.parse(init.body);
    expect(body.models.length).toBeGreaterThan(1);
    expect(body.model).toBeUndefined();
  });

  it("uses a single model when one is configured", async () => {
    const fetch = stubFetch([["openai.com", () => answer("[]")]]);
    const [openai] = createAiSources({ fetch, env: { OPENAI_API_KEY: "k", OPENAI_MODEL: "gpt-test" } });
    await openai.search("ibuprofen");
    expect(JSON.parse(fetch.calls[0].init.body).model).toBe("gpt-test");
  });
});
