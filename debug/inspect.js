// Run locally with: node debug/inspect.js
// Saves the fully-rendered HTML (after scrolling to load the full week of
// listings) and a screenshot to debug/output/.
import { chromium } from 'playwright';
import { config } from '../src/config.js';
import { mkdirSync, writeFileSync } from 'fs';

const OUT_DIR = new URL('./output/', import.meta.url).pathname;
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.listing-tile', { timeout: 30000 });
await page.waitForTimeout(1000);

// #facilityListingsContainer lazily loads more slots as it's scrolled.
const containerSelector = '#facilityListingsContainer';
if (await page.$(containerSelector)) {
  let previousCount = -1;
  let stableRounds = 0;
  for (let i = 0; i < 40; i++) {
    const count = await page.$$eval('.listing-tile', (els) => els.length);
    if (count === previousCount) {
      stableRounds++;
      if (stableRounds >= 3) break;
    } else {
      stableRounds = 0;
    }
    previousCount = count;
    await page.$eval(containerSelector, (el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(800);
  }
}

const finalCount = await page.$$eval('.listing-tile', (els) => els.length);

const html = await page.content();
writeFileSync(OUT_DIR + 'rendered.html', html);
await page.screenshot({ path: OUT_DIR + 'screenshot.png', fullPage: true });

console.log(`Captured ${finalCount} slot tiles after auto-scrolling.
Saved:
  ${OUT_DIR}rendered.html
  ${OUT_DIR}screenshot.png`);

await browser.close();
