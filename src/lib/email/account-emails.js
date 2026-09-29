/** Short emails about logins: a new sign-up for the admins, and "you're in" for the person. */
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function layout(paragraphs, button) {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;">${esc(p)}</p>`)
    .join('');
  const cta = `<a href="${esc(button.href)}" style="display:inline-block;background:#14624e;color:#fff;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;">${esc(button.label)}</a>`;
  return `<div style="font-family:Arial,sans-serif;color:#101a17;max-width:520px;">${body}${cta}</div>`;
}

export function renderSignupNotice({ name, teamLabel, email, phone }, baseUrl) {
  const lines = [
    `${name} used the ${teamLabel} invite link and is waiting for you to approve them.`,
    `Email: ${email} · Phone: ${phone}`,
    'If you don’t know them, decline the request on the Logins screen.',
  ];
  return {
    subject: `New sign-up waiting: ${name} (${teamLabel})`,
    html: layout(lines, { href: `${baseUrl}/users`, label: 'Open Logins' }),
    text: `${lines.join('\n')}\n\nOpen Logins: ${baseUrl}/users`,
  };
}

export function renderApproved({ name, teamLabel }, baseUrl) {
  const lines = [
    `Hello ${name},`,
    `You’ve been approved to join the ${teamLabel} on the Ptchapel app.`,
    'Sign in with your email address and the password you chose.',
  ];
  return {
    subject: 'You’re in: Ptchapel app',
    html: layout(lines, { href: `${baseUrl}/login`, label: 'Sign in' }),
    text: `${lines.join('\n')}\n\nSign in: ${baseUrl}/login`,
  };
}
