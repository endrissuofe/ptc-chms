import { formatPhone } from '../phone';
import { CELEBRATIONS, socialsText } from '../celebrations';

/** The 7 AM "birthdays and anniversaries" email for the admin / media team. */
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const dayName = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const who = (p) => (p.who === 'member' ? 'Member' : 'First timer');

function todayBlock(p) {
  const kind = CELEBRATIONS[p.kind].label;
  const post = socialsText(p.kind, p.name);
  return {
    html: `<div style="border:1px solid #e0e6e2;border-radius:12px;padding:14px 16px;margin:0 0 10px;background:#fff;">
      <div style="font-weight:700;">${esc(p.name)}</div>
      <div style="color:#586862;font-size:13px;">${esc(kind)} · ${esc(who(p))} · ${esc(formatPhone(p.phone))}${p.canSms ? ' · SMS wish sent automatically' : ' · no SMS (not agreed)'}</div>
      <div style="margin-top:10px;padding:10px 12px;background:#f0f4f1;border-radius:10px;font-size:14px;">${esc(post)}</div>
    </div>`,
    text: `- ${p.name} (${kind}, ${who(p)}, ${formatPhone(p.phone)})\n  For socials: ${post}`,
  };
}

export function celebrationsSubject(today, week) {
  const n = today.length;
  const parts = [];
  if (n) parts.push(`${n} ${n === 1 ? 'celebration' : 'celebrations'} today`);
  const later = week.reduce((sum, d) => sum + d.people.length, 0);
  if (later) parts.push(`${later} more this week`);
  return `Birthdays and anniversaries: ${parts.join(' · ')}`;
}

/**
 * today: people celebrating today; week: [{ date, people }] for the rest of the week (Mondays),
 * or []. baseUrl links to the Birthdays screen.
 */
export function renderCelebrations({ date, today, week }, baseUrl) {
  const blocks = today.map(todayBlock);
  const weekRows = week
    .filter((d) => d.people.length)
    .map((d) => ({
      html: `<tr><td style="padding:8px 12px;border-top:1px solid #e0e6e2;font-weight:700;white-space:nowrap;vertical-align:top;">${esc(dayName.format(new Date(d.date)))}</td>
        <td style="padding:8px 12px;border-top:1px solid #e0e6e2;">${d.people.map((p) => `${esc(p.name)} <span style="color:#586862;">(${esc(CELEBRATIONS[p.kind].label.toLowerCase())})</span>`).join('<br>')}</td></tr>`,
      text: `${dayName.format(new Date(d.date))}: ${d.people.map((p) => `${p.name} (${CELEBRATIONS[p.kind].label.toLowerCase()})`).join(', ')}`,
    }));
  const link = `${baseUrl}/birthdays`;
  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f3;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;font:15px/1.5 Arial,sans-serif;color:#101a17;">
    <p style="margin:0 0 4px;color:#14624e;font:800 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">Ptchapel · Celebrations</p>
    <h1 style="font:900 24px Arial,sans-serif;margin:0 0 8px;">${today.length ? 'Today we celebrate' : 'This week we celebrate'}</h1>
    <p style="margin:0 0 16px;color:#32403b;">${esc(dayName.format(new Date(date)))}. Wish them, and copy a line for the church’s WhatsApp, Instagram or Facebook.</p>
    ${blocks.map((b) => b.html).join('')}
    ${weekRows.length ? `<h2 style="font:800 17px Arial,sans-serif;margin:24px 0 8px;">Coming up this week</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e0e6e2;border-radius:12px;border-collapse:separate;background:#fff;">${weekRows.map((r) => r.html).join('')}</table>` : ''}
    <p style="margin:28px 0;"><a href="${esc(link)}" style="background:#14624e;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;display:inline-block;">Open Birthdays</a></p>
  </div></body></html>`;
  const text = `${dayName.format(new Date(date))}\n\n${blocks.map((b) => b.text).join('\n')}\n${weekRows.length ? `\nComing up this week:\n${weekRows.map((r) => r.text).join('\n')}\n` : ''}\nOpen Birthdays: ${link}\n`;
  return { subject: celebrationsSubject(today, week), html, text };
}
