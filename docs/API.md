# Search server API

All endpoints are `GET`, return JSON and send `Cache-Control: no-store`. Cross-origin calls are
allowed only from the origins in `ALLOWED_ORIGINS`.

## `GET /api/health`

```json
{ "status": "ok", "version": "2.4.0", "uptimeSec": 42 }
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

Official sources also carry `countries` (the countries they cover; `"European Union"` for EU-wide
authorisations) and, where the terms set one, `reuse` (a condition of reuse beyond naming the
source, for example "Not for commercial or marketing use"). The app counts the countries with data
from this list and copies `terms` and `reuse` into downloaded files.

`state` is `ready` (with `rows` and `updatedAt`) / `loading` / `error` for downloaded datasets, `live` for live APIs (or `error`
after a failed call; `unavailable` when Health Canada's live API is down), and `disabled` for an AI
provider without a key or a dataset whose imported file is not there yet (Finland before the first
upload).

## `GET /api/search?q=<ingredient or brand>[&country=<country>]` and `GET /api/ai?q=…`

`/api/search` returns the official sources (the national datasets, Spain, Canada). `/api/ai`
returns the AI providers only, in the same format; it is slower, cached for a day and limited to
10 calls per minute per visitor.

| Parameter | Rules |
|---|---|
| `q` | required; 2–80 characters: letters, digits, spaces and `.,'()/+-` |
| `country` | optional; a country name as in the app's list, or `all`. Passed to the AI prompt; a source covering several countries keeps that country's products; other official sources are filtered in the app. |

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
  most 60 per source are returned, single-ingredient products first. A source covering several
  countries (EMA Article 57) returns the chosen country's brands (up to 60) when `country` is one
  of them, else up to 20 per country.
- Each entry of `sources` also carries the source's `homepage`, `terms` and, where set, `reuse`, so
  the app's downloads can name them without another call.
- Source `state`: `ok`, `error` (with `detail`), `unavailable` (the provider itself is down, with
  `detail`), `disabled` (no key, or no imported file) or `skipped` (daily AI limit). An answer with
  `error`, `unavailable` or `skipped` is cached for 5 minutes only.
- Answers over 1 KB are gzip-compressed when the request accepts it.
- `cached: true` appears when the answer came from the cache.
- `brand` appears when `q` is not an ingredient in any dataset but is a brand name there. Every
  source was then asked for the ingredient (`searchFor`) instead:

  ```json
  "brand": {
    "name": "Flomax",
    "ingredient": "Tamsulosin Hydrochloride",
    "searchFor": "tamsulosin",
    "others": [{ "ingredient": "Morniflumate", "countries": ["Italy"] }]
  }
  ```

  `others` lists other ingredients the same brand name stands for in other countries (at most
  three). The ingredient is the one most products with that exact name contain, single-ingredient
  products first, written as an English-language register spells it; salt words after the first
  word ("Sodium Phosphate", "Hydrochloride") are left out of `searchFor` so every salt is found.

CSV and JSON downloads are made in the browser from the merged results (see the README), not by
the server.

Errors: `400` invalid `q` or `country`; `429` too many searches (see `Retry-After`); `404` unknown
`/api` path; `405` any method other than `GET`, `HEAD` or `OPTIONS`.

## Other paths

- `/.well-known/sustainability-data`: the site's signed sustainability declaration, served as
  `application/sustainability-data+json` with `Access-Control-Allow-Origin: *`.
- `/assets/*`: hashed build files, cached for a year.
- Any other path without a file extension returns the app (`index.html`); missing files return 404.
