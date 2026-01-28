# Welcome to Medicine Brand Finder

## Project info

Medicine Finder uses several online free medicine APIs (in RxNorm international format or others) and other 3rd party AI engines calls and Databases, to search for an active drug medicine substance component and return all known brands, medicines, containing the specified substance, useful for finding medicines in different other countries by doctor's prescription, moving patient data from one system into another and other international usages. 

The project is frontend only and would require backend in a reliable scalable version, currently being a proof-of-concept mvp.
**Live Demo (without AI API keys, real DB, and other limitations)**


## What technologies are used for this project?

This project is automatically and manually built with:
- TypeScript
- React
- Lovable
- Vite
- shadcn-ui
- Tailwind CSS
- Supabase/Vercel/Openrouter.ai integrations


### .env API keys, for some searches to work - or securely add backend Supabase Edge Function for them (as in current implementation)
Note: Some APIs (RxNorm, OpenFDA, EMA, WHO, ClinicalTrials, PubChem, Wikidata) are free and do not require API keys.
DeepSeek/OpenRouter offers a free tier with generous limits if you register to use it.
APIs and/or engines might need either local setup, changes of URLS, registering your API keys (locally in env and exposed, or as functions responses in supabase/deployment/etc.)

