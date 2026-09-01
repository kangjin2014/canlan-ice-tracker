import { chromium } from 'playwright';
import { config } from './config.js';

/**
 * Scrapes the CatchCorner rental page and returns a list of ice slots.
 *
 * CatchCorner is an Angular app — the listings render as repeated
 * <app-listing-tile> elements once the page finishes loading. We use a
 * headless browser so we see exactly what a real visitor sees, rather than
 * trying to reverse-engineer whichever API calls + client-side math produce
 * the final displayed price.
 *
 * Known DOM shape (captured via debug/inspect.js):
 *
 * <app-listing-tile>
 *   <div class="listing-tile">
 *     <div class="listing-tile__date-contianer">
 *       <p class="listing-tile__weekday">TUE</p>
 *       <p class="listing-tile__date">Sep 01</p>
 *     </div>
 *     <div class="listing-tile__info-container">
 *       <p class="listing-tile__title">Entripy Centre - Canlan Oakville</p>
 *       <p class="listing-tile__price">$251.00</p>
 *       <p class="listing-tile__time"><span>5:15pm - 6:15pm</span></p>
 *       <span class="listing-tile__tag"> Rink 1 (200ft x 85ft) (Oakville) </span>
 *     </div>
 *   </div>
 * </app-listing-tile>
 *
 * Note: the date shown has no year, and the list only shows what's currently
 * loaded (may need scrolling/pagination for further-out dates — not handled
 * yet).
 */
export async function scrapeSlots() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 'domcontentloaded' instead of 'networkidle' — this page seems to have
    // background network activity (analytics/polling) that never goes fully
    // quiet, which made 'networkidle' time out unreliably. Waiting for the
    // actual listing content below is the real signal we care about anyway.
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.listing-tile', { timeout: 30000 });
    // Small settle buffer in case tiles are still streaming in.
    await page.waitForTimeout(1000);

    // #facilityListingsContainer is its own scrollable div (not the page),
    // and lazily loads more slots as it's scrolled toward the bottom. Keep
    // scrolling it until the tile count stops growing.
    await autoScrollListings(page);

    const raw = await page.$$eval('.listing-tile', (tiles) =>
      tiles.map((tile) => ({
        weekday: tile.querySelector('.listing-tile__weekday')?.textContent.trim() || '',
        date: tile.querySelector('.listing-tile__date')?.textContent.trim() || '',
        title: tile.querySelector('.listing-tile__title')?.textContent.trim() || '',
        price: tile.querySelector('.listing-tile__price')?.textContent.trim() || '',
        time: tile.querySelector('.listing-tile__time')?.textContent.replace(/\s+/g, ' ').trim() || '',
        rink: tile.querySelector('.listing-tile__tag')?.textContent.replace(/\s+/g, ' ').trim() || '',
      }))
    );

    return raw.map(normalizeSlot).filter(Boolean);
  } finally {
    await browser.close();
  }
}

// Repeatedly scrolls #facilityListingsContainer to its bottom, waiting after
// each scroll for lazily-loaded slots to render, until three consecutive
// scrolls produce no new tiles (or we hit a safety cap on iterations).
async function autoScrollListings(page) {
  const containerSelector = '#facilityListingsContainer';
  const hasContainer = await page.$(containerSelector);
  if (!hasContainer) return; // fall back to whatever's already rendered

  let previousCount = -1;
  let stableRounds = 0;
  const maxRounds = 40;

  for (let i = 0; i < maxRounds; i++) {
    const count = await page.$$eval('.listing-tile', (els) => els.length);

    if (count === previousCount) {
      stableRounds++;
      if (stableRounds >= 3) break;
    } else {
      stableRounds = 0;
    }
    previousCount = count;

    await page.$eval(containerSelector, (el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(800);
  }
}

function normalizeSlot(raw) {
  const price = Number(raw.price.replace(/[^0-9.]/g, ''));
  if (!price || Number.isNaN(price)) return null;

  const dateISO = resolveDate(raw.date);
  const startHour = parseStartHour(raw.time);

  return {
    price,
    date: raw.date,       // "Sep 01" as shown on the page
    dateISO,               // resolved with a guessed year, for sorting/display
    weekday: raw.weekday,
    time: raw.time,
    startHour,              // 24h decimal, e.g. 6:30am -> 6.5; null if unparseable
    rink: raw.rink,
    title: raw.title,
    // Stable id for dedupe — doesn't include price, so a re-priced slot
    // still counts as "the same slot" rather than alerting twice.
    id: `${raw.date}|${raw.time}|${raw.rink}`,
  };
}

// Parses the leading time out of strings like "6:00am - 7:00am" and returns
// it as a 24h decimal hour (6.5 = 6:30). Returns null if it can't be parsed
// (the slot is then excluded, rather than silently treated as "early").
function parseStartHour(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return null;

  let [, h, m, period] = match;
  h = Number(h);
  m = Number(m);
  if (period.toLowerCase() === 'pm' && h !== 12) h += 12;
  if (period.toLowerCase() === 'am' && h === 12) h = 0;

  return h + m / 60;
}

// The page shows "Sep 01" with no year. Assume the current year, but roll
// forward to next year if that date would be more than ~30 days in the past
// (handles the Dec -> Jan rollover near year-end).
function resolveDate(dateStr) {
  const now = new Date();
  const guess = new Date(`${dateStr} ${now.getFullYear()}`);
  if (Number.isNaN(guess.getTime())) return null;

  const daysDiff = (guess - now) / (1000 * 60 * 60 * 24);
  if (daysDiff < -30) {
    guess.setFullYear(guess.getFullYear() + 1);
  }
  return guess.toISOString().slice(0, 10);
}
