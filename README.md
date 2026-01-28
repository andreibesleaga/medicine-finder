# Welcome to Medicine Brand Finder

## Project info

Medicine Finder uses several online free medicine APIs (in RxNorm international format or others) and other 3rd party AI engines calls and Databases, to search for an active drug medicine substance component and return all known brands, medicines, containing the specified substance, useful for finding medicines in different other countries by doctor's prescription, moving patient data from one system into another and other international usages.
The project is frontend only but would require some backend in a reliable, scalable version, and currently is only a proof-of-concept mvp.


**Live Demo (without AI API, real DB, and other limitations)**



## What technologies are used for this project?

This project is built with:
- Lovable (& manual code editing)
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase/Vercel/Openrouter.ai integrations (backend/frontend calls)



### .env API keys, for some searches to work - or securely add backend Supabase Edge Function for them (as in current implementation)
Note: Some APIs (RxNorm, OpenFDA, EMA, WHO, ClinicalTrials, PubChem, Wikidata) are free and do not require API keys.
DeepSeek offers a free tier with generous limits if you register to use it.
The other APIs and/or engines might need either local setup or registering your API keys (locally in env and exposed, or as functions responses in Supabase/Vercel/etc.)

