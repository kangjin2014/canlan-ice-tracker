export const config = {
  url: process.env.CATCHCORNER_URL ||
    'https://www.catchcorner.com/facility-page/embedded/rental/canlan-sports-oakville',
  priceThreshold: Number(process.env.PRICE_THRESHOLD || 150),
  earliestHour: Number(process.env.EARLIEST_HOUR ?? 7), // 24h clock; slots starting before this are skipped
  latestHour: Number(process.env.LATEST_HOUR ?? 19), // 24h clock; slots starting at/after this are skipped
  emailTo: process.env.EMAIL_TO,
  emailFrom: process.env.EMAIL_FROM,
  resendApiKey: process.env.RESEND_API_KEY,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

export function assertConfig() {
  const missing = [];
  if (!config.emailTo) missing.push('EMAIL_TO');
  if (!config.emailFrom) missing.push('EMAIL_FROM');
  if (!config.resendApiKey) missing.push('RESEND_API_KEY');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
