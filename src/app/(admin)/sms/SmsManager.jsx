'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { smsSegments, unicodeCharacters } from '@/lib/sms/segments';
import { BELATED_THANKS, TEMPLATE_INFO, renderTemplate, unknownTags } from '@/lib/sms/templates';

const SAMPLE = {
  FirstName: 'Chinedu',
  LastName: 'Okafor',
  ChurchName: 'RCCG Peculiar Treasure Chapel',
  ServiceTimes: 'Service starts at 8:00 AM.',
};

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});
const when = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });

const card = 'rounded-xl border border-line bg-surface p-5';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted';
const primaryBtn =
  'flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-primary px-4 text-[15px] font-semibold text-white hover:bg-primary-dark disabled:opacity-40';
const secondaryBtn =
  'flex h-11 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-line bg-surface px-4 text-[15px] font-semibold hover:border-primary disabled:opacity-40';

async function call(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Something went wrong');
  return data;
}

export default function SmsManager({ status, balance, templates, upcoming, missedThanks, runs }) {
  return (
    <>
      <StatusBanner status={status} />

      <div className="grid gap-4 md:grid-cols-3">
        <BalanceCard status={status} balance={balance} />
        <section className={card}>
          <p className={eyebrow}>Sender name</p>
          <p className="mt-1 font-serif text-2xl font-semibold">{status.senderId}</p>
          <p className="mt-2 text-[13px] text-muted">
            Shown as who the SMS is from. It must be registered with BulkSMS Nigeria, or networks
            may block it or replace it with a number.
          </p>
        </section>
        <section className={card}>
          <p className={eyebrow}>Next sends</p>
          <ul className="mt-2 flex flex-col gap-3 text-[13px]">
            {['sunday_thanks', 'saturday_invite'].map((key) => {
              const next = upcoming[key];
              return (
                <li key={key}>
                  <p className="font-semibold">
                    {TEMPLATE_INFO[key].title} · {dayLabel.format(new Date(next.serviceDate))}
                  </p>
                  <p className="text-muted">
                    {next.toSend} {next.toSend === 1 ? 'person' : 'people'} so far
                    {next.noConsent > 0 && ` · ${next.noConsent} didn’t agree to messages`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {missedThanks.map((m) => (
        <MissedThanks key={m.serviceDate} missed={m} live={status.live} />
      ))}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold">Automatic messages</h2>
          <p className="text-[13px] text-muted">
            Midweek and special services don’t send SMS yet — only Sunday first timers.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => (
            <TemplateEditor key={t.key} template={t} live={status.live} />
          ))}
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-line bg-stage-class-bg p-5 text-stage-class-text">
        <Icon name="cake" size={22} />
        <div>
          <p className="font-semibold">Birthday and anniversary messages — coming later</p>
          <p className="text-[13px]">
            Planned with the members directory. Birthdays from first-timer cards are already being
            saved.
          </p>
        </div>
      </section>

      <RunHistory runs={runs} />
    </>
  );
}

function StatusBanner({ status }) {
  if (status.live && status.scheduled) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-stage-regular-bg px-5 py-4 text-[15px] font-semibold text-stage-regular-text">
        <Icon name="check_circle" size={20} filled />
        SMS are live through BulkSMS Nigeria, and the automatic Sunday and Saturday sends are on.
      </p>
    );
  }
  return (
    <details className="rounded-xl border border-line bg-stage-first-bg px-5 py-4 text-stage-first-text">
      <summary className="flex cursor-pointer items-start gap-2 text-[15px] font-semibold">
        <Icon name="error_outline" size={20} />
        {status.live
          ? 'SMS are live, but the automatic Sunday and Saturday sends are off.'
          : 'SMS are off — messages are only recorded here; nobody receives them.'}
        <span className="ml-auto shrink-0 text-[13px] underline">How to switch on</span>
      </summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[13px] text-ink">
        <li>Make sure the sender name {status.senderId} is registered with BulkSMS Nigeria.</li>
        <li>
          In Vercel → Settings → Environment Variables, add <code>BULKSMSNIGERIA_API_TOKEN</code>{' '}
          (from your BulkSMS Nigeria account) and set <code>SMS_PROVIDER</code> to{' '}
          <code>bulksmsnigeria</code>.
        </li>
        <li>
          Add <code>CRON_SECRET</code> with a long random value. This switches on the automatic
          sends (Sundays 6 PM, Saturdays 10 AM).
        </li>
        <li>Redeploy, then use “Send test to my phone” below to check it works.</li>
      </ol>
    </details>
  );
}

function BalanceCard({ status, balance }) {
  return (
    <section className={card}>
      <p className={eyebrow}>SMS balance</p>
      {!status.live ? (
        <p className="mt-2 text-[15px] text-muted">Not connected while SMS are off.</p>
      ) : balance?.error ? (
        <p className="mt-2 text-[13px] text-danger">Couldn’t read the balance: {balance.error}</p>
      ) : balance ? (
        <>
          <p className="mt-1 font-serif text-2xl font-semibold">{naira.format(balance.amount)}</p>
          <p className="mt-2 text-[13px] text-muted">
            As reported by BulkSMS Nigeria. Top up there.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-muted">BulkSMS Nigeria didn’t report a balance.</p>
      )}
    </section>
  );
}

/** Message editor with page count, tags, a live preview and a test send. */
function MessageBox({ templateKey, value, onChange, id }) {
  const ref = useRef(null);
  const seg = smsSegments(renderTemplate(value, SAMPLE));
  const odd = unicodeCharacters(value);
  const bad = unknownTags(templateKey, value);

  function insert(tag) {
    const el = ref.current;
    const text = `{${tag}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={eyebrow}>
          Message
        </label>
        <span
          className={`text-[11px] font-semibold ${seg.pages > 1 ? 'text-primary' : 'text-secondary'}`}
        >
          about {seg.length} characters · {seg.pages} {seg.pages === 1 ? 'page' : 'pages'}
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={4}
        maxLength={459}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-[10px] border-[1.5px] border-line p-3 text-[15px] leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-muted">Insert:</span>
        {TEMPLATE_INFO[templateKey].tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => insert(tag)}
            className="flex h-8 items-center gap-1 rounded-md border border-line bg-paper px-2 text-[12px] font-semibold"
          >
            <Icon name="add" size={14} />
            {`{${tag}}`}
          </button>
        ))}
      </div>
      {bad.length > 0 && (
        <p className="text-[13px] text-danger">
          {`{${bad[0]}}`} isn’t a tag this message can use. Check the spelling.
        </p>
      )}
      {odd.length > 0 && (
        <p className="text-[13px] text-primary">
          {odd.map((c) => `“${c}”`).join(' ')} {odd.length === 1 ? 'makes' : 'make'} each page hold
          only 70 characters, so the message costs more. Use plain quotes and write “NGN” or “N”
          instead of ₦ to avoid it.
        </p>
      )}
      <div className="rounded-lg bg-paper p-3 text-[13px]">
        <p className={`${eyebrow} mb-1`}>Preview</p>
        {renderTemplate(value, SAMPLE)}
      </div>
    </div>
  );
}

function TemplateEditor({ template, live }) {
  const router = useRouter();
  const info = TEMPLATE_INFO[template.key];
  const [saved, setSaved] = useState({ body: template.body, enabled: template.enabled });
  const [body, setBody] = useState(template.body);
  const [enabled, setEnabled] = useState(template.enabled);
  const [state, setState] = useState({ kind: 'idle' });
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const dirty = body.trim() !== saved.body || enabled !== saved.enabled;
  const bad = unknownTags(template.key, body).length > 0;

  async function save() {
    setState({ kind: 'busy' });
    try {
      const doc = await call(`/api/sms/templates?key=${template.key}`, 'PATCH', {
        body: body.trim(),
        enabled,
      });
      setSaved({ body: doc.body, enabled: doc.enabled });
      setBody(doc.body);
      setState({ kind: 'ok', message: 'Saved' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  async function sendTest() {
    setState({ kind: 'busy' });
    try {
      await call('/api/sms/test', 'POST', {
        templateKey: template.key,
        phone: testPhone,
        body: body.trim(),
      });
      setState({
        kind: 'ok',
        message: live
          ? 'Test sent. It should arrive within a minute.'
          : 'Test recorded. SMS are off, so nothing was actually sent.',
      });
      setTesting(false);
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  return (
    <section className={`${card} flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{info.title}</h3>
          <p className="text-[13px] text-muted">{info.schedule}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
          {enabled ? 'On' : 'Off'}
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-7 w-12 rounded-full bg-line transition peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        </label>
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2 text-[13px]">
        <Icon name="group" size={16} className="mt-0.5 text-muted" />
        {info.recipients}
      </p>

      <MessageBox
        id={`message-${template.key}`}
        templateKey={template.key}
        value={body}
        onChange={(v) => {
          setBody(v);
          setState({ kind: 'idle' });
        }}
      />

      {state.kind === 'error' && (
        <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-[13px] text-danger">
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="text-[13px] font-semibold text-secondary">
          {state.message}
        </p>
      )}

      {testing ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-paper p-3">
          <label className="flex flex-1 flex-col gap-1 text-[13px] font-semibold">
            Your phone number
            <input
              type="tel"
              inputMode="numeric"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="0803 000 0000"
              className="h-11 rounded-[10px] border-[1.5px] border-line bg-surface px-3 font-normal outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            onClick={sendTest}
            disabled={!testPhone || bad || state.kind === 'busy'}
            className={primaryBtn}
          >
            <Icon name="send" size={18} />
            Send test
          </button>
          <button type="button" onClick={() => setTesting(false)} className={secondaryBtn}>
            Cancel
          </button>
          <p className="w-full text-[11px] text-muted">
            Uses your first name in place of {'{FirstName}'}.
            {live ? ' Uses one SMS credit per page.' : ' SMS are off, so it’s only recorded.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" onClick={() => setTesting(true)} className={secondaryBtn}>
            <Icon name="smartphone" size={18} />
            Send test to my phone
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || bad || !body.trim() || state.kind === 'busy'}
            className={primaryBtn}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      )}
    </section>
  );
}

/** A past Sunday whose first timers never got their thank-you (e.g. SMS was off). */
function MissedThanks({ missed, live }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(BELATED_THANKS);
  const [state, setState] = useState({ kind: 'idle' });
  const day = dayLabel.format(new Date(missed.serviceDate));

  async function send() {
    setState({ kind: 'busy' });
    try {
      const res = await call('/api/sms/missed-thanks', 'POST', {
        serviceDate: missed.serviceDate,
        body: body.trim(),
      });
      setState({
        kind: 'ok',
        message: `Sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}${res.failed ? `, ${res.failed} failed — see below` : ''}.`,
      });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  return (
    <section className={`${card} flex flex-col gap-3 border-primary/40`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon name="schedule_send" size={22} className="text-primary" />
          <div>
            <p className="font-semibold">Thank-you not sent for {day}</p>
            <p className="text-[13px] text-muted">
              {missed.toSend} first {missed.toSend === 1 ? 'timer' : 'timers'} agreed to messages
              but haven’t been thanked.
            </p>
          </div>
        </div>
        {!open && state.kind !== 'ok' && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!live}
            className={secondaryBtn}
          >
            Send thank-you now…
          </button>
        )}
      </div>
      {!live && (
        <p className="text-[13px] text-muted">
          Switch SMS on first — sending while they’re off would mark these people as thanked without
          reaching them.
        </p>
      )}
      {open && state.kind !== 'ok' && (
        <>
          <MessageBox
            id={`missed-${missed.serviceDate}`}
            templateKey="sunday_thanks"
            value={body}
            onChange={setBody}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={send}
              disabled={state.kind === 'busy' || unknownTags('sunday_thanks', body).length > 0}
              className={primaryBtn}
            >
              <Icon name="send" size={18} />
              Send to {missed.toSend} {missed.toSend === 1 ? 'person' : 'people'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
              Cancel
            </button>
          </div>
        </>
      )}
      {state.kind === 'error' && (
        <p role="alert" className="text-[13px] text-danger">
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="text-[13px] font-semibold text-secondary">
          {state.message}
        </p>
      )}
    </section>
  );
}

function RunHistory({ runs }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold">Recent sends</h2>
        <p className="text-[13px] text-muted">
          “Sent” means BulkSMS Nigeria accepted the message; it can’t tell us whether the phone
          received it.
        </p>
      </div>
      {runs.length === 0 ? (
        <p className={`${card} text-[15px] text-muted`}>Nothing has been sent yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-line bg-paper text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Message</th>
                <th className="px-4 py-3 text-right font-semibold">Sent</th>
                <th className="px-4 py-3 text-right font-semibold">Failed</th>
                <th className="px-4 py-3 text-right font-semibold">Cost</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => (
                <RunRow key={r.run} run={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RunRow({ run }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');

  async function toggle() {
    setOpen((o) => !o);
    if (people || open) return;
    try {
      const data = await call(`/api/sms/logs?run=${encodeURIComponent(run.run)}`, 'GET');
      setPeople(data.items);
    } catch (err) {
      setError(err.message);
    }
  }

  const title = run.test ? 'Test messages' : (TEMPLATE_INFO[run.template]?.title ?? run.template);
  return (
    <>
      <tr>
        <td className="px-4 py-3 whitespace-nowrap">{when.format(new Date(run.lastAt))}</td>
        <td className="px-4 py-3">
          <span className="font-semibold">{title}</span>
          {run.provider === 'mock' && (
            <span className="ml-2 rounded-full bg-stage-second-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
              Not really sent (SMS off)
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">{run.sent}</td>
        <td
          className={`px-4 py-3 text-right tabular-nums ${run.failed ? 'font-semibold text-danger' : ''}`}
        >
          {run.failed}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {run.cost ? naira.format(run.cost) : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
          >
            {open ? 'Hide' : 'Who'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-paper px-4 py-3">
            {error ? (
              <p className="text-danger">{error}</p>
            ) : !people ? (
              <p className="text-muted">Loading…</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {people.map((p, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-muted">{p.to}</span>
                    <span className={p.status === 'sent' ? 'text-secondary' : 'text-danger'}>
                      {p.status === 'sent' ? 'Sent' : `Failed: ${p.error || 'unknown reason'}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
