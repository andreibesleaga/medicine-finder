# Deploying

**Railway is the default.** One service runs the Docker image: the Node server serves the app and
`/api`. **Vercel is off** and can be switched on as a second, static copy of the app that uses the
Railway server for `/api`.

## Railway (default)

The service builds from `Dockerfile`, as set in `railway.json`, with the health check on
`/api/health`. Railway deploys every push to `main`.

### Variables

Set them in the Railway dashboard (service → Variables) or with the CLI. None of them is required.

| Variable | Purpose | Default |
|---|---|---|
| `OPENAI_API_KEY` | turns on OpenAI suggestions | off |
| `PERPLEXITY_API_KEY` | turns on Perplexity suggestions | off |
| `DEEPSEEK_API_KEY` | turns on DeepSeek suggestions | off |
| `OPENROUTER_API_KEY` | turns on OpenRouter suggestions | off |
| `OPENAI_MODEL`, `PERPLEXITY_MODEL`, `DEEPSEEK_MODEL` | model per provider | `gpt-5-mini`, `sonar`, `deepseek-chat` |
| `OPENROUTER_MODEL` | model, or a comma-separated list tried in order | `openrouter/free` (any available free model; slower and less steady than a paid model) |
| `AI_DAILY_LIMIT` | AI calls per day (UTC) for all visitors together | `500` |
| `AI_RATE_LIMIT` | AI requests per minute per visitor | `10` |
| `AI_CACHE_SECONDS` | how long an AI answer is cached | `86400` |
| `DATA_DIR` | where the SQLite database is kept | `/app/data` in the image |
| `SEARCH_RATE_LIMIT` | searches per minute per visitor | `20` |
| `SEARCH_CACHE_SECONDS` | how long an answer is cached | `3600` |
| `ALLOWED_ORIGINS` | other sites allowed to call `/api` (the Vercel copy) | none |

`PORT` is provided by Railway.

**Optional volume:** mount a Railway volume at `/app/data` (service → Settings → Volumes) so the
national datasets survive deploys. Without it they are downloaded again after each deploy, which
takes about 3 minutes in the background; meanwhile those sources show "loading".

```bash
railway link --project medicine-finder --service medicine-finder --environment production
railway variables --set "OPENROUTER_API_KEY=sk-or-..."   # one per key you have
railway up --detach                                     # deploy the local tree now (optional)
railway logs                                            # "AI providers: ..." shows which keys are active
```

### Checks after a deploy

```bash
curl -s https://medicine-finder.up.railway.app/api/health
curl -s https://medicine-finder.up.railway.app/api/sources | jq '.sources[] | {id, state, detail}'
curl -s 'https://medicine-finder.up.railway.app/api/search?q=ibuprofen' | jq '.sources'
```

## Vercel (off by default)

Vercel only hosts static files, so a Vercel copy runs the same app and sends its `/api` calls to
Railway.

**What keeps it off:**

- `vercel.json` has `"git": { "deploymentEnabled": false }`, so pushes do not deploy to Vercel.
- The app loads Vercel Web Analytics only when it is built with `VITE_VERCEL_ANALYTICS=true`.

**To switch it on:**

1. In `vercel.json`, set `"deploymentEnabled": true`. Or leave it `false` and deploy by hand with
   `npx vercel --prod`.
2. In the Vercel project (Settings → Environment Variables), add:
   - `VITE_API_BASE=https://medicine-finder.up.railway.app`
   - `VITE_VERCEL_ANALYTICS=true`
3. On Railway, set `ALLOWED_ORIGINS=https://<your-project>.vercel.app` (comma-separate several).
4. If the Railway address changes, update `connect-src` in `vercel.json` too.

**To switch it off again:**

- Set `"deploymentEnabled": false`.
- Optionally disconnect the repository in Vercel (Project → Settings → Git → Disconnect), so its
  GitHub check and the "Preview" and "medicine-finder / production" environments stop being updated.

Without `VITE_API_BASE`, a static copy still works, with the browser sources and curated lists only.
The results then say the search server is not available.

## Local

```bash
npm ci
npm run dev                  # app only, http://localhost:8080 (no /api: official EU/FR/ES/CA data is skipped)
npm run build && npm start   # app + /api on http://localhost:8080
cp .env.example .env && npm run build && node --env-file=.env server/index.js   # with AI keys
docker build -t medicine-finder . && docker run --rm -p 8080:8080 --env-file .env medicine-finder
```

For development with both: `npm run build && PORT=8787 npm run dev:server`, then
`VITE_API_BASE=http://localhost:8787 npm run dev`. Also set `ALLOWED_ORIGINS=http://localhost:8080`
for the server.
