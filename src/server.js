import http from 'node:http';
import { runCheck } from './check.js';
import { config } from './config.js';

const PORT = process.env.PORT || 3000;

// Guards against two overlapping scrapes if you (or a scheduler) hit
// /check twice in quick succession — each run launches a headless browser,
// so we don't want them stacking up.
let isRunning = false;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Root path is a plain health check — Render (and anyone poking the URL)
  // gets a fast 200 without triggering a scrape.
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('canlan-ice-tracker is up. Hit /check?key=... to run a check.');
    return;
  }

  if (url.pathname === '/check') {
    if (config.checkSecret && url.searchParams.get('key') !== config.checkSecret) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden — pass ?key=<CHECK_SECRET>');
      return;
    }

    if (isRunning) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'A check is already running — try again in a few seconds.' }));
      return;
    }

    isRunning = true;
    try {
      const result = await runCheck();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Check failed:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } finally {
      isRunning = false;
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`canlan-ice-tracker listening on port ${PORT}`);
  if (!config.checkSecret) {
    console.warn('CHECK_SECRET is not set — /check is publicly triggerable by anyone with the URL.');
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down.');
  server.close(() => process.exit(0));
});
