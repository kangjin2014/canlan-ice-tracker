import Redis from 'ioredis';
import { config } from './config.js';

const SEEN_KEY = 'canlan:seen-slots';
const TTL_SECONDS = 60 * 60 * 24 * 14; // forget a slot after 2 weeks

let client;
let redisAvailable = true;

function getClient() {
  if (!client) {
    client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't keep retrying — fail fast
      lazyConnect: true,
    });
    client.on('error', () => {
      // Swallowed here; individual calls below handle/report failures.
      // Without this listener, ioredis's unhandled 'error' event crashes the process.
    });
  }
  return client;
}

/**
 * Returns just the slot ids we haven't already alerted on.
 * If Redis is unreachable, logs a warning and treats every slot as unseen
 * (better to risk a duplicate alert than to silently skip alerting).
 */
export async function filterUnseen(slots) {
  if (!redisAvailable) return slots;

  const redis = getClient();
  try {
    await redis.connect();
  } catch {
    // already connected or failed — fall through, get() below will tell us
  }

  const unseen = [];
  for (const slot of slots) {
    try {
      const key = `${SEEN_KEY}:${hash(slot.id)}`;
      const alreadySeen = await redis.get(key);
      if (!alreadySeen) unseen.push(slot);
    } catch (err) {
      console.warn(`Redis unavailable (${err.message}) — treating all slots as unseen this run.`);
      redisAvailable = false;
      return slots;
    }
  }
  return unseen;
}

/** Marks slots as alerted so we don't email about them again. No-ops if Redis is down. */
export async function markSeen(slots) {
  if (!redisAvailable || !slots.length) return;

  const redis = getClient();
  try {
    const pipeline = redis.pipeline();
    for (const slot of slots) {
      const key = `${SEEN_KEY}:${hash(slot.id)}`;
      pipeline.set(key, '1', 'EX', TTL_SECONDS);
    }
    await pipeline.exec();
  } catch (err) {
    console.warn(`Couldn't save alerted-slot state to Redis (${err.message}).`);
  }
}

export async function closeStore() {
  if (client && redisAvailable) {
    try {
      await client.quit();
    } catch {
      // already disconnected, nothing to do
    }
  }
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}