// AI suggestions from OpenAI, Perplexity, DeepSeek and OpenRouter. Each provider is used only
// when its key is set on the server. Answers are suggestions, never verified data.

import { fetchJson } from "../lib/http.js";

export const AI_TIMEOUT_MS = 45000;

export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    keyVar: "OPENAI_API_KEY",
    modelVar: "OPENAI_MODEL",
    defaultModel: "gpt-5-mini",
    url: "https://api.openai.com/v1/chat/completions",
    body: (model, messages) => ({ model, messages, max_completion_tokens: 4000, reasoning_effort: "minimal" }),
  },
  {
    id: "perplexity",
    name: "Perplexity",
    keyVar: "PERPLEXITY_API_KEY",
    modelVar: "PERPLEXITY_MODEL",
    defaultModel: "sonar",
    url: "https://api.perplexity.ai/chat/completions",
    body: (model, messages) => ({ model, messages, max_tokens: 1500, temperature: 0.1 }),
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    keyVar: "DEEPSEEK_API_KEY",
    modelVar: "DEEPSEEK_MODEL",
    defaultModel: "deepseek-chat",
    url: "https://api.deepseek.com/chat/completions",
    body: (model, messages) => ({ model, messages, max_tokens: 1500, temperature: 0.1 }),
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    keyVar: "OPENROUTER_API_KEY",
    modelVar: "OPENROUTER_MODEL",
    // "openrouter/free" routes to whichever free model is available; a comma-separated list
    // in OPENROUTER_MODEL is sent as fallbacks instead
    defaultModel: "openrouter/free",
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: { "HTTP-Referer": "https://medicine-finder.up.railway.app", "X-Title": "Medicine Brand Finder" },
    body: (model, messages) => {
      const models = model.split(",").map((m) => m.trim()).filter(Boolean);
      // no "thinking" step: free reasoning models otherwise take 20-30 s for a short list
      return { ...(models.length > 1 ? { models } : { model: models[0] }), messages, max_tokens: 900, temperature: 0.1, reasoning: { enabled: false } };
    },
  },
];

export function buildMessages(term, country) {
  const where = country ? ` marketed in ${country}` : " marketed in any country";
  return [
    {
      role: "system",
      content:
        "You list pharmaceutical brand names. Answer with a JSON array only, no prose. Include only brands you are confident exist. If unsure, return [].",
    },
    {
      role: "user",
      content:
        `List up to 10 brand names of medicines whose active ingredient is "${term}"${where}. ` +
        'Each item: {"brandName": string, "country": string, "manufacturer": string}.',
    },
  ];
}

/** Extracts the first JSON array from a model answer (handles ```json fences and surrounding text). */
export function parseBrandList(content) {
  if (typeof content !== "string") return [];
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let items;
  try {
    items = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i && typeof i.brandName === "string" && i.brandName.trim() && i.brandName.length <= 80)
    .slice(0, 10)
    .map((i) => ({
      brandName: i.brandName.trim(),
      country: typeof i.country === "string" && i.country.trim() ? i.country.trim().slice(0, 60) : "Not stated",
      manufacturer: typeof i.manufacturer === "string" && i.manufacturer.trim() ? i.manufacturer.trim().slice(0, 80) : undefined,
    }));
}

export function createAiSources({ fetch, env }) {
  return PROVIDERS.map((p) => {
    const key = () => (env[p.keyVar] || "").trim();
    const model = () => (env[p.modelVar] || "").trim() || p.defaultModel;
    return {
      id: `ai-${p.id}`,
      name: `AI suggestion: ${p.name}`,
      kind: "ai",
      coverage: "Any country; unverified model output",
      homepage: new URL(p.url).origin,
      enabled: () => Boolean(key()),
      status: () => (key() ? { state: "live", detail: `model ${model().split(",")[0]}` } : { state: "disabled", detail: `set ${p.keyVar} to enable` }),
      async search(term, { country } = {}) {
        const json = await fetchJson(fetch, p.url, {
          method: "POST",
          timeoutMs: AI_TIMEOUT_MS,
          headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...p.headers },
          body: JSON.stringify(p.body(model(), buildMessages(term, country))),
        });
        return parseBrandList(json?.choices?.[0]?.message?.content).map((b) => ({
          brandName: b.brandName,
          activeIngredient: term,
          country: b.country,
          manufacturer: b.manufacturer,
        }));
      },
    };
  });
}
