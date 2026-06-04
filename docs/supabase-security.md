# Supabase Edge Functions — security notes

The app can route AI/proprietary searches through Supabase Edge Functions so that
provider API keys stay on the server instead of in the browser bundle.

## When this path is used

Controlled by `VITE_USE_SECURE_API` (see `.env.example`):

- **`false` / unset (default):** searches run client-side using the `VITE_*` keys.
  Those keys are embedded in the static build and are publicly visible.
- **`true`:** searches call the functions in [`supabase/functions/`](../supabase/functions)
  (`openai-search`, `openrouter-search`, `deepseek-search`, `perplexity-search`),
  which hold the provider keys as Supabase function secrets.

## Functions and their secrets

| Function | Provider key (set as a Supabase secret) |
|---|---|
| `openai-search` | `OPENAI_API_KEY` |
| `openrouter-search` | `OPENROUTER_API_KEY` |
| `deepseek-search` | `DEEPSEEK_API_KEY` |
| `perplexity-search` | `PERPLEXITY_API_KEY` |

Set them with `supabase secrets set OPENAI_API_KEY=...` (never commit real keys).

## Hardening recommendation

The bundled functions are intended for demo use and do not enforce caller
authentication. Before exposing them publicly you should:

- require a valid Supabase JWT (verify the `Authorization` header), and/or
- add per-IP rate limiting, and restrict CORS to your own origin.

These are noted here rather than enabled by default so the demo's behavior stays
unchanged; the secure path is opt-in.
