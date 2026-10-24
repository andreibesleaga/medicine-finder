# Search server API

All endpoints are `GET`, return JSON and send `Cache-Control: no-store`. Cross-origin calls are
allowed only from the origins in `ALLOWED_ORIGINS`.

## `GET /api/health`

```json
{ "status": "ok", "version": "2.3.1", "uptimeSec": 42 }
```

Used by the Railway health check.

## `GET /api/sources`

The server-side sources and their state.

```json
{
  "sources": [
    {
      "id": "ema",
      "name": "European Medicines Agency (EMA)",
      "kind": "official",
      "coverage": "European Union, centrally authorised medicines",
      "homepage": "https://www.ema.europa.eu/en/medicines/download-medicine-data",
      "terms": "https://www.ema.europa.eu/en/about-us/legal-notice",
      "enabled": true,
      "state": "ready",
      "updatedAt": "2026-10-24T13:18:16.000Z"
    },
    { "id": "ai-openai", "kind": "ai", "enabled": false, "state": "disabled", "detail": "set OPENAI_API_KEY to enable", "...": "..." }
  ]
}
```

`state` is `ready` (with `rows` and `updatedAt`) / `loading` / `error` for downloaded datasets, `live` for live APIs (or `error`
after a failed call; `unavailable` when Health Canada's live API is down), and `disabled` for an AI
provider without a key or a dataset whose imported file is not there yet (Finland before the first
upload).

## `GET /api/search?q=<ingredient>[&country=<country>]` and `GET /api/ai?q=…`

`/api/search` returns the official sources (the national datasets, Spain, Canada). `/api/ai`
returns the AI providers only, in the same format; it is slower, cached for a day and limited to
10 calls per minute per visitor.

| Parameter | Rules |
|---|---|
| `q` | required; 2–80 characters: letters, digits, spaces and `.,'()/+-` |
| `country` | optional; a country name as in the app's list, or `all`. Passed to the AI prompt only; official sources are filtered in the app. |

Response:

```json
{
  "term": "ibuprofen",
  "country": null,
  "results": [
    {
      "brandName": "Pedea",
      "activeIngredient": "Ibuprofen",
      "country": "European Union",
      "manufacturer": "Recordati Rare Diseases",
      "status": "Authorised",
      "url": "https://www.ema.europa.eu/en/medicines/human/EPAR/pedea",
      "sourceId": "ema",
      "sourceName": "European Medicines Agency (EMA)",
      "kind": "official"
    }
  ],
  "sources": [
    { "id": "ema", "name": "European Medicines Agency (EMA)", "kind": "official", "state": "ok", "count": 2, "ms": 3 },
    { "id": "health-canada-live", "name": "Health Canada, Drug Product Database (live API)", "kind": "official", "state": "unavailable", "count": 0, "detail": "Health Canada's API is not answering (HTTP 503 from health-products.canada.ca)", "ms": 420 }
  ],
  "cached": true
}
```

- Result fields other than `brandName`, `activeIngredient`, `country`, `sourceId`, `sourceName` and
  `kind` are optional: `manufacturer`, `strength`, `dosageForm`, `status`, `url`.
- `kind` is `official` or `curated` for `/api/search`, `ai` for `/api/ai`.
- `count` is how many the source found (brands, for the datasets; CIMA's own total for Spain); at
  most 60 per source are returned, single-ingredient products first.
- Source `state`: `ok`, `error` (with `detail`), `unavailable` (the provider itself is down, with
  `detail`), `disabled` (no key, or no imported file) or `skipped` (daily AI limit). An answer with
  `error`, `unavailable` or `skipped` is cached for 5 minutes only.
- Answers over 1 KB are gzip-compressed when the request accepts it.
- `cached: true` appears when the answer came from the cache.

Errors: `400` invalid `q` or `country`; `429` too many searches (see `Retry-After`); `404` unknown
`/api` path; `405` any method other than `GET`, `HEAD` or `OPTIONS`.

## Other paths

- `/.well-known/sustainability-data`: the site's signed sustainability declaration, served as
  `application/sustainability-data+json` with `Access-Control-Allow-Origin: *`.
- `/assets/*`: hashed build files, cached for a year.
- Any other path without a file extension returns the app (`index.html`); missing files return 404.
