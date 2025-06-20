# Welcome to Medicine Brand Finder

## Project info

Medicine Finder uses several online free medicine APIs (in RxNorm international format or others) and other 3rd party AI engines calls and Databases, to search for an active drug medicine substance component and return all known brands, medicines, containing the specified substance, useful for finding medicines in different other countries by doctor's prescription, moving patient data from one system into another and other international documentation usage.


**Live Demo URL**: https://medicine-finder.lovable.app

**URL**: https://github.com/andreibesleaga/medicine-finder


## What technologies are used for this project?

This project is built with:

- Lovable (and manual code edit)
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS





### .env API keys, for AI searches to work
### API Keys for Medicine Search
### Copy this file to .env.local and add your actual API keys

OpenAI API Key (for ChatGPT medicine search)
VITE_OPENAI_API_KEY=your_openai_api_key_here

Perplexity AI API Key (for enhanced search)
VITE_PERPLEXITY_API_KEY=your_perplexity_api_key_here

DeepSeek AI API Key (free tier available)
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key_here

DrugBank API Key (for pharmaceutical database access)
VITE_DRUGBANK_API_KEY=your_drugbank_api_key_here

ChemSpider API Key (for chemical database access)
VITE_CHEMSPIDER_API_KEY=your_chemspider_api_key_here

Note: Some APIs (RxNorm, OpenFDA, EMA, WHO, ClinicalTrials, PubChem, Wikidata) 
are free and do not require API keys.
DeepSeek offers a free tier with generous limits.
