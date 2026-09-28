import { formatPhone } from '../phone';
import { OUTCOMES } from '../followup';
import { STAGE_LABELS } from '../stages';
import { formatMoment } from '../format';
import { RATINGS } from '../checkin';

/**
 * The morning follow-up email: new first-timer cards from one day, and who is still waiting for a call after
 * 72 hours. Names and numbers only — never prayer requests.
 */
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

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const shortDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function followUpSubject(report) {
  const parts = [];
  if (report.firstTimers.length) {
    parts.push(
      `${plural(report.firstTimers.length, 'new first timer', 'new first timers')} (${shortDay.format(new Date(report.day))})`,
    );
  }
  if (report.returning.length) parts.push(`${report.returning.length} came back`);
  const calls = (report.checkIns ?? []).filter((c) => c.wantsCall).length;
  if (calls) parts.push(`${plural(calls, 'person asked', 'people asked')} for a call`);
  if (report.overdue.length) {
    parts.push(
      `${plural(report.overdue.length, 'person', 'people')} still not called after 72 hours`,
    );
  }
  return `Follow-up: ${parts.join(' · ')}`;
}

function personLine(p, baseUrl, extra) {
  return {
    html: `<tr>
      <td style="padding:10px 12px;border-top:1px solid #ece7f0;">
        <a href="${esc(baseUrl)}/newcomers/${esc(p.id)}" style="color:#1e1b3a;font-weight:700;text-decoration:none;">${esc(p.name)}</a>
        <div style="color:#625e7d;font-size:13px;">${esc(formatPhone(p.phone))}${p.stage ? ` · ${esc(STAGE_LABELS[p.stage] || p.stage)}` : ''}${p.service ? ` · ${esc(p.service)}` : ''}</div>${
          p.address
            ? `
        <div style="color:#625e7d;font-size:13px;">${esc(p.address)}</div>`
            : ''
        }
      </td>
      <td style="padding:10px 12px;border-top:1px solid #ece7f0;color:#3d3960;font-size:13px;text-align:right;">${esc(extra)}</td>
    </tr>`,
    text: `- ${p.name} (${formatPhone(p.phone)}${p.address ? `, ${p.address}` : ''})${extra ? ` — ${extra}` : ''}`,
  };
}

function section(title, rows) {
  if (!rows.length) return { html: '', text: '' };
  return {
    html: `<h2 style="font:800 17px Arial,sans-serif;color:#1e1b3a;margin:24px 0 8px;">${esc(title)}</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #ece7f0;border-radius:12px;border-collapse:separate;font:15px Arial,sans-serif;">${rows.map((r) => r.html).join('')}</table>`,
    text: `${title}\n${rows.map((r) => r.text).join('\n')}\n`,
  };
}

const lastTry = (p) => {
  if (!p.lastOutcome || !p.tried) return 'Not called yet';
  const who = p.lastCallerName ? ` by ${p.lastCallerName}` : '';
  return `${OUTCOMES[p.lastOutcome]?.label ?? p.lastOutcome} ${formatMoment(p.lastAttemptAt)}${who}`;
};

/** { subject, html, text } for the report. baseUrl makes the names links into the app. */
export function renderFollowUpReport(report, baseUrl) {
  const day = dayName.format(new Date(report.day));
  const came = section(
    `New first-timer cards · ${shortDay.format(new Date(report.day))} (${report.firstTimers.length})`,
    report.firstTimers.map((p) => personLine(p, baseUrl, 'Please call')),
  );
  const back = section(
    `Came back · ${shortDay.format(new Date(report.day))} (${report.returning.length})`,
    report.returning.map((p) => personLine(p, baseUrl, `${p.visitCount} visits`)),
  );
  const overdue = section(
    `Still not reached after 72 hours (${report.overdue.length})`,
    report.overdue.map((p) => personLine(p, baseUrl, `Waiting ${p.days} days · ${lastTry(p)}`)),
  );
  const answers = section(
    `One-month check-in answers (${(report.checkIns ?? []).length})`,
    (report.checkIns ?? []).map((c) =>
      personLine(
        { ...c, stage: null },
        baseUrl,
        [
          c.rating && `${c.rating}/5 ${RATINGS[c.rating].label}`,
          c.wantsCall && 'Asked for a call',
          c.comment && `“${c.comment}”`,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    ),
  );
  const subject = followUpSubject(report);
  const button = `${baseUrl}/my-newcomers`;

  const html = `<!doctype html><html><body style="margin:0;background:#faf7f2;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;font:15px/1.5 Arial,sans-serif;color:#1e1b3a;">
    <p style="margin:0 0 4px;color:#b1361b;font:800 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">PTC Chapel · Follow-up</p>
    <h1 style="font:900 24px Arial,sans-serif;margin:0 0 8px;">Good morning, follow-up team</h1>
    <p style="margin:0;color:#3d3960;">Here is who needs a call. Report for ${esc(day)}.</p>
    ${came.html}${back.html}${overdue.html}${answers.html}
    <p style="margin:28px 0;"><a href="${esc(button)}" style="background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;display:inline-block;">Open the follow-up list</a></p>
    <p style="color:#625e7d;font-size:13px;margin:0;">Log each call in the app so the pastors can see it. This email goes to the follow-up team, with the pastors copied in. It comes every morning while anyone is waiting.</p>
  </div></body></html>`;

  const text = `Good morning, follow-up team. Report for ${day}.\n\n${came.text}\n${back.text}\n${overdue.text}\n${answers.text}\nOpen the follow-up list: ${button}\n`;
  return { subject, html, text };
}
