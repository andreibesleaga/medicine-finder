# Welcome to Medicine Brand Finder

> [!WARNING]
> **Proof-of-concept / demo — not medical advice.** Results are aggregated from
> third-party data sources and AI engines and may be inaccurate, incomplete, or
> out of date. Do not use this tool for diagnosis, treatment, prescribing, or
> dispensing decisions. Always consult a qualified healthcare professional and
> official drug labeling.

## Project info

Medicine Finder uses several online free medicine APIs (in RxNorm international format or others) and other 3rd party AI engines calls and Databases, to search for an active drug medicine substance component and return all known brands, medicines, containing the specified substance, useful for finding medicines in different other countries by doctor's prescription, moving patient data from one system into another and other international usages. 

The project is frontend only and would require backend in a reliable scalable version, currently being a proof-of-concept mvp.

**Live demo:** deployed on Railway. It runs client-side only, so the free public
medicine APIs work out of the box; AI-engine and DrugBank/ChemSpider results need
your own API keys (see below) or the optional secure backend.


## What technologies are used for this project?

This project is automatically and manually built with:
- TypeScript
- React
- Lovable
- Vite
- shadcn-ui
- Tailwind CSS
- Supabase/Vercel/Openrouter.ai integrations


### .env API keys, for some searches to work - or securely add backend Supabase Edge Function for them
Note: Some APIs (RxNorm, OpenFDA, EMA, WHO, ClinicalTrials, PubChem, Wikidata) are free and do not require API keys.
DeepSeek/OpenRouter offers a free tier with generous limits if you register to use it.
APIs and/or engines might need either local setup, changes of URLS, registering your API keys (locally in env and exposed, or as functions responses in supabase/deployment/etc.)

Copy `.env.example` to `.env` and fill the keys you have. See [.env.example](./.env.example) for the full list.

> [!CAUTION]
> Any `VITE_*` value is **bundled into the browser build and publicly visible**.
> By default (`VITE_USE_SECURE_API` unset/`false`) the AI/DrugBank/ChemSpider keys
> you set are exposed client-side — only use keys you are comfortable exposing, or
> set `VITE_USE_SECURE_API=true` to route those calls through the Supabase Edge
> Functions in [supabase/functions/](./supabase/functions) so the keys stay
> server-side (see [docs/supabase-security.md](./docs/supabase-security.md)).

## Run & test

```bash
npm install          # (the Docker build uses --legacy-peer-deps)
npm run dev          # local dev server at http://localhost:8080
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # strict TypeScript check
npm test             # Vitest unit tests (data adapters + secure-API toggle)
```

## Manual review checklist

- **config:** copy `.env.example` → `.env`; free APIs need no keys; AI keys optional; `VITE_USE_SECURE_API` toggles the secure backend path
- **run:** `npm install` → `npm run dev` (or `npm run build` + `npm run preview`)
- **examples:** search an active ingredient (e.g. "ibuprofen") to list brands/medicines
- **result:** merged, de-duplicated brand list from RxNorm/OpenFDA/EMA/etc. (+ AI engines if keys set)
- **path:** data adapters in `src/utils/api/`, secure wrapper `src/utils/api/secureApiWrapper.ts`, edge functions `supabase/functions/`

