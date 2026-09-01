# canlan-ice-tracker

Watches the CatchCorner rental page for Canlan Sports Oakville and emails you
when ice slots show up at or below a price threshold.

## How it works

CatchCorner's page is client-rendered (React), and the displayed price isn't
reliably present in a single API response — some of it is computed in the
browser. So instead of reverse-engineering their API, this uses a headless
browser (Playwright) to load the page like a real user would, then reads
whatever prices end up on screen.

```
src/scraper.js   -> loads the page in headless Chromium, extracts slots
src/store.js     -> Redis-backed "have we already alerted on this?" check
src/emailer.js   -> sends the alert email via Resend
src/index.js     -> ties it together; this is what runs on each cron tick
debug/inspect.js -> saves rendered HTML + screenshot for tightening selectors
```

## How it runs

This is a **web service**, not a scheduled cron job — it does nothing until
you hit its `/check` endpoint. That way you're not paying for (or wasting)
compute on checks nobody needed.

```
GET https://<your-service>.onrender.com/check?key=<CHECK_SECRET>
```

- `/` — plain health check (used by Render), does **not** trigger a scrape
- `/check?key=...` — runs one scrape/alert cycle and returns a JSON summary.
  Requires the `key` to match `CHECK_SECRET` (set in Render's dashboard) —
  otherwise anyone with your public URL could trigger scrapes.

### Triggering it

Pick whatever fits how you actually want to use it:
- **Manually** — bookmark the URL (with key), tap it whenever you're
  wondering about ice prices
- **Phone shortcut** — iOS Shortcuts / Android equivalent can hit a URL with
  one tap or on a schedule you control locally (no server cost either way)
- **Free external scheduler** — [cron-job.org](https://cron-job.org) or
  [UptimeRobot](https://uptimerobot.com) can ping the URL every N minutes
  for free, giving you cron-like behavior without Render billing you for a
  dedicated cron job
- **Render Cron Job hitting this service** — if you want it fully
  self-contained in Render, a separate free/cheap cron job that just does
  `curl` against `/check` is lighter than running the whole scrape+browser
  as the cron job itself

Note: Render's free/starter web services spin down after inactivity, so the
first hit after idle time will be slower (cold start + browser launch) —
that's normal, not a bug.

## How it works

CatchCorner's page is client-rendered (React), and the displayed price isn't
reliably present in a single API response — some of it is computed in the
browser. So instead of reverse-engineering their API, this uses a headless
browser (Playwright) to load the page like a real user would, then reads
whatever prices end up on screen. It also auto-scrolls the listings
container, since CatchCorner lazy-loads a week's worth of slots as you
scroll rather than rendering them all up front.

```
src/scraper.js   -> loads the page in headless Chromium, extracts slots
src/store.js     -> Redis-backed "have we already alerted on this?" check
src/emailer.js   -> sends the alert email via Resend
src/check.js     -> the actual scrape -> filter -> dedupe -> alert logic
src/server.js    -> HTTP server; /check runs src/check.js on demand
src/index.js     -> one-off CLI runner (npm run check:once), for local testing
debug/inspect.js -> saves rendered HTML + screenshot for tightening selectors
```

## Local setup

```bash
cp .env.example .env
# fill in EMAIL_TO, EMAIL_FROM, RESEND_API_KEY, CHECK_SECRET
# REDIS_URL can point at a local redis, or Render's once deployed

npm install
npx playwright install --with-deps chromium

npm run check:once   # run a single check and exit, no server
# — or —
npm start             # start the HTTP server, then curl localhost:3000/check?key=...
```

## Deploying on Render

`render.yaml` defines:
- a **Web Service** running `npm start` (the HTTP server above)
- a free **Key Value** (Redis-compatible) service, used to remember which
  slots have already triggered an email so repeated `/check` hits don't
  re-email you about the same slot

After pushing to `main`, set `EMAIL_TO`, `EMAIL_FROM`, `RESEND_API_KEY`, and
`CHECK_SECRET` in the Render dashboard for the `canlan-ice-tracker` service
(marked `sync: false` in render.yaml, so they're not stored in git). If
you'd already deployed this manually (not via the Blueprint), just make sure
those same env vars are set on your existing service, and that the start
command is `npm start`.

## Config (env vars)

| Var | Purpose |
|---|---|
| `CATCHCORNER_URL` | Page to watch |
| `PRICE_THRESHOLD` | Alert when a slot's price is at/below this (CAD) |
| `EARLIEST_HOUR` / `LATEST_HOUR` | Only alert on slots starting in this window (24h clock) |
| `EMAIL_TO` / `EMAIL_FROM` | Alert email addresses |
| `RESEND_API_KEY` | resend.com API key |
| `CHECK_SECRET` | Required as `?key=` on `/check`; keeps your endpoint private |
| `REDIS_URL` | Render Key Value connection string |
