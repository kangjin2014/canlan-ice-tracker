import { config, assertConfig } from './config.js';
import { scrapeSlots } from './scraper.js';
import { filterUnseen, markSeen } from './store.js';
import { sendCheapIceAlert } from './emailer.js';

/**
 * Runs one full check: scrape -> filter by price/time -> dedupe against
 * Redis -> email if there's anything new. Returns a summary object.
 * Used by both the HTTP server (src/server.js) and the one-off CLI runner
 * (src/index.js).
 */
export async function runCheck() {
  assertConfig();

  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] Checking ${config.url} ...`);

  const slots = await scrapeSlots();
  console.log(`Found ${slots.length} total slot(s) on the page.`);

  const cheap = slots.filter(
    (s) =>
      s.price <= config.priceThreshold &&
      s.startHour !== null &&
      s.startHour >= config.earliestHour &&
      s.startHour < config.latestHour
  );
  console.log(
    `${cheap.length} slot(s) at or below $${config.priceThreshold} and starting between ` +
      `${config.earliestHour}:00 and ${config.latestHour}:00.`
  );

  const newCheap = await filterUnseen(cheap);
  console.log(`${newCheap.length} of those are new (not previously alerted).`);

  if (newCheap.length) {
    await sendCheapIceAlert(newCheap);
    await markSeen(newCheap);
    console.log('Alert email sent.');
  } else {
    console.log('Nothing new to alert on.');
  }

  return {
    checkedAt: startedAt.toISOString(),
    totalSlots: slots.length,
    cheapSlots: cheap.length,
    newlyAlerted: newCheap.length,
    alertedSlots: newCheap,
  };
}
