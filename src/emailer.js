import { config } from './config.js';

export async function sendCheapIceAlert(slots) {
  if (!slots.length) return;

  const rows = slots
    .sort((a, b) => a.price - b.price)
    .map(
      (s) =>
        `<li><strong>$${s.price.toFixed(2)}/hr</strong> — ${escapeHtml(s.weekday)} ${escapeHtml(s.date)}, ` +
        `${escapeHtml(s.time)} — ${escapeHtml(s.rink)}</li>`
    )
    .join('\n');

  const html = `
    <p>Found ${slots.length} cheap ice slot${slots.length > 1 ? 's' : ''} at Canlan Sports Oakville
    (at or below $${config.priceThreshold}):</p>
    <ul>${rows}</ul>
    <p><a href="${config.url}">Book here</a></p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [config.emailTo],
      subject: `\u{1F3D2} ${slots.length} cheap ice slot${slots.length > 1 ? 's' : ''} at Canlan Oakville`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
