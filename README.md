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

## ⚠️ Before this actually works well

`src/scraper.js` currently uses a **generic heuristic**: it looks for any
text matching `$X.XX` and grabs the nearest reasonably-sized container as
context. This will work but will be noisy (may pick up unrelated prices,
won't cleanly separate date/time/rink into their own fields).

To fix that:
1. Run `npm install && npx playwright install --with-deps chromium`
2. Run `npm run debug:capture` (uses `.env`, see below)
3. Open `debug/output/rendered.html`, search for `$`, find a slot's markup
4. Share that HTML snippet so the extraction in `scraper.js` can be swapped
   for exact selectors and clean `{ date, time, rink, price }` fields instead
   of a blob of text.

## Local setup

```bash
cp .env.example .env
# fill in EMAIL_TO, EMAIL_FROM, RESEND_API_KEY (resend.com, free tier)
# REDIS_URL can point at a local redis, or Render's once deployed

npm install
npx playwright install --with-deps chromium
npm start
```

## Deploying on Render

`render.yaml` defines:
- a **Cron Job** service that runs `npm start` on a schedule (every 15 min
  by default — edit the `schedule` field)
- a free **Key Value** (Redis-compatible) service, used to remember which
  slots have already triggered an email so you're not spammed every tick

After pushing to `main`, set `EMAIL_TO`, `EMAIL_FROM`, and `RESEND_API_KEY`
in the Render dashboard for the `canlan-ice-tracker` service (marked
`sync: false` in render.yaml, so they're not stored in git).

## Config (env vars)

| Var | Purpose |
|---|---|
| `CATCHCORNER_URL` | Page to watch |
| `PRICE_THRESHOLD` | Alert when a slot's price is at/below this (CAD) |
| `EMAIL_TO` / `EMAIL_FROM` | Alert email addresses |
| `RESEND_API_KEY` | resend.com API key |
| `REDIS_URL` | Render Key Value connection string |
