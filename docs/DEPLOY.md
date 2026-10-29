# Deploying

**Railway is the default.** One service runs the Docker image: the Node server serves the app and
`/api`. **Vercel is off** and can be switched on as a second, static copy of the app that uses the
Railway server for `/api`.

## Railway (default)

The service builds from `Dockerfile`, as set in `.railway/railway.ts` (Railway's infrastructure
as code; it replaced `railway.json`), with the health check on `/api/health` and the volume at
`/app/data`. Railway deploys every push to `main` on its own, without waiting for CI (merge to
`main` only when CI is green). To change these settings, edit the file, then `railway config plan`
(preview) and `railway config apply`.

The service sleeps when it has had no traffic for a while (`sleepApplication`), and the first
request wakes it in a few seconds. The hourly dataset check only runs while it is awake; on waking
it checks every dataset at once and reloads the stale ones in the background.

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
| `HEALTH_CANADA` | Canada's data: `dataset` (monthly extract, always answers), `live` (API per search), `both`, or `off` | `dataset` |
| `RAILWAY_RUN_UID` | `0` lets the app write to the Railway volume (volumes are mounted as root; the image runs as `node`) | set on Railway |
| `SEARCH_RATE_LIMIT` | searches per minute per visitor | `20` |
| `SEARCH_CACHE_SECONDS` | how long an answer is cached (memory and database, so it survives restarts) | `3600` |
| `GLOBAL_SEARCH_RATE_LIMIT`, `GLOBAL_AI_RATE_LIMIT` | searches / AI requests per minute for all visitors together | `300`, `60` |
| `TRUST_FORWARDED_FOR` | `false` on a host where no proxy sets `X-Real-IP`/`X-Forwarded-For`, so a visitor cannot pick its own address for the limits (Railway sets `X-Real-IP`) | `true` |
| `WARM_TERMS` | most searched terms (last 30 days) searched again once a day; `0` = off | `50` |
| `OPENFDA_API_KEY` | openFDA labels queried by the server (120,000 calls/day) instead of each browser (1,000/day per address); free key at https://open.fda.gov/apis/authentication/ | off (browser) |
| `ALLOWED_ORIGINS` | other sites allowed to call `/api` (the Vercel copy) | none |
| `DIST_DIR` | folder of the built app (for tests and unusual layouts) | `dist` |

`PORT` is provided by Railway.

The per-visitor limits count by `X-Real-IP`, which Railway's proxy sets, and fall back to the first
`X-Forwarded-For` entry and then the socket address (`server/lib/rateLimit.js`). A client can send
`X-Forwarded-For` itself, so on a host with no proxy that sets `X-Real-IP`, set
`TRUST_FORWARDED_FOR=false`; the limits for all visitors together and the daily AI cap still hold
against forged addresses.

**Volume:** a Railway volume is mounted at `/app/data`, so the national datasets survive deploys
and searches are complete right after a deploy. Without it they are downloaded again after each
deploy, which takes about 3 minutes in the background; meanwhile those sources show "loading".
Railway mounts volumes as root, so `RAILWAY_RUN_UID=0` is set; without it SQLite cannot write
there and the service fails to start. The app therefore runs as root on Railway (see
[SECURITY.md](../SECURITY.md)); the image itself runs as `node` everywhere else. To create both on a new service:

```bash
railway volume add --mount-path /app/data
railway variables --set "RAILWAY_RUN_UID=0"
```

```bash
railway link --project medicine-finder --service medicine-finder --environment production
railway variables --set "OPENROUTER_API_KEY=sk-or-..."   # one per key you have
railway up --detach                                     # deploy the local tree now (optional)
railway logs                                            # "AI providers: ..." shows which keys are active
```

### Finland (imported file)

fimea.fi answers scripts with a browser check, so the server cannot download Finland's register.
It is imported by hand, about once a month (Fimea updates it nightly):

1. In a browser, open https://fimea.fi/en/databases_and_registers/basic-register-xml and download
   the basic register XML (`Perusrekisteri.xml`, about 200 MB; unzip it if it comes zipped).
2. Upload it to the volume, replacing the previous one. Railway's volume file commands use SSH, so
   the first time register a key with Railway (`ssh-keygen -t ed25519`, then `railway ssh keys add`):

   ```bash
   railway volume files --volume medicine-finder-data upload --overwrite ./Perusrekisteri.xml /imports/Perusrekisteri.xml
   ```

The server checks every hour and reloads Finland when the file is newer than its data (about
10 s); a file put there after a failed load is tried at the next check, without the usual hour's
wait. Until the first upload the source shows "off". Locally, put the file in
`data/imports/Perusrekisteri.xml` (Docker: the `/app/data/imports` folder of the volume).

### Checks after a deploy

```bash
curl -s https://medicine-finder.up.railway.app/api/health
curl -s https://medicine-finder.up.railway.app/api/sources | jq '.sources[] | {id, state, detail}'
curl -s 'https://medicine-finder.up.railway.app/api/search?q=ibuprofen' | jq '.sources'
```

### Roll back, recover, rotate keys

- **Bad deploy:** `railway redeploy -s medicine-finder --commit <SHA of the last good commit> -y`
  deploys that commit once, without pinning it; the next push to `main` deploys as usual.
  `railway redeploy -s medicine-finder -y` redeploys the latest deployment as it is, and
  `--from-source` pulls the latest commit again (`railway redeploy --help`).
- **Damaged or lost database:** nothing needs a backup. The database only copies public registers
  (and the search answers it caches); every dataset downloads again within about 3 minutes of a
  start. With the service stopped, delete `medicines.sqlite`, `medicines.sqlite-wal` and
  `medicines.sqlite-shm` from `DATA_DIR`, keep the `imports/` folder, and start it again. On
  Railway the delete command is `railway volume files --volume medicine-finder-data delete <path>`.
  Finland comes back from the file in `imports/`; if that is gone, import it again (above).
- **Rotate an AI or openFDA key:** create the new key at the provider, set it with
  `railway variables --set "<NAME>=<new key>"`, restart the service (a running server keeps the
  variables it started with), then revoke the old key at the provider. `railway logs` shows which
  AI providers are active.

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
npm run dev                  # app only, http://localhost:8080 (no /api: the national registers, Spain, the curated lists and AI are skipped)
npm run build && npm start   # app + /api on http://localhost:8080
cp .env.example .env && npm run build && node --env-file=.env server/index.js   # with AI keys
docker build -t medicine-finder . && docker run --rm -p 8080:8080 --env-file .env medicine-finder
```

For development with both: `npm run build && PORT=8787 npm run dev:server`, then
`VITE_API_BASE=http://localhost:8787 npm run dev`. Also set `ALLOWED_ORIGINS=http://localhost:8080`
for the server.
