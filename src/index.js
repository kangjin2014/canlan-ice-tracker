// Runs a single check and exits. Handy for local testing without spinning
// up the HTTP server. The deployed service uses src/server.js instead.
import { runCheck } from './check.js';
import { closeStore } from './store.js';

runCheck()
  .catch((err) => {
    console.error('Run failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeStore();
  });
