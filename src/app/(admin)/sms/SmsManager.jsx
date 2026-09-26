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

const card = 'card';
const eyebrow = 'label-caps';
const primaryBtn = 'btn btn-primary';
const secondaryBtn = 'btn btn-ghost';

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
          <p className="mt-1 font-display text-3xl font-black">{status.senderId}</p>
          <p className="mt-2 text-[13px] text-muted">
            Shown as who the SMS is from. It must be registered with BulkSMS Nigeria, or networks
            may block it or replace it with a number.
          </p>
        </section>
        <section className={card}>
          <p className={eyebrow}>Next sends</p>
          <ul className="mt-2 flex flex-col gap-3 text-sm">
            {['sunday_thanks', 'saturday_invite'].map((key) => {
              const next = upcoming[key];
              return (
                <li key={key}>
                  <p className="font-display font-extrabold">
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
          <h2 className="text-2xl font-black">Automatic messages</h2>
          <p className="text-[13px] text-muted">
            Midweek and special services don’t send SMS yet — only Sunday first timers.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          {templates.map((t) => (
            <TemplateEditor key={t.key} template={t} live={status.live} />
          ))}
        </div>
      </section>

      <section className="card flex items-start gap-4 border-violet/30 bg-violet-soft text-violet">
        <Icon name="cake" size={22} />
        <div>
          <p className="font-display text-lg font-extrabold">
            Birthday and anniversary messages — coming later
          </p>
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
      <p className="alert alert-success text-[15px]">
        <Icon name="check_circle" size={20} filled />
        SMS are live through BulkSMS Nigeria, and the automatic Sunday and Saturday sends are on.
      </p>
    );
  }
  return (
    <details className="rounded-card border border-coral/30 bg-coral-soft px-5 py-4 text-coral-ink">
      <summary className="flex cursor-pointer items-start gap-2 font-display text-base font-extrabold">
        <Icon name="error_outline" size={20} />
        {status.live
          ? 'SMS are live, but the automatic Sunday and Saturday sends are off.'
          : 'SMS are off — messages are only recorded here; nobody receives them.'}
        <span className="ml-auto shrink-0 font-sans text-[13px] font-bold underline">
          How to switch on
        </span>
      </summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm text-ink">
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
          <p className="mt-1 font-display text-3xl font-black">{naira.format(balance.amount)}</p>
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
        <span className={`chip ${seg.pages > 1 ? 'chip-warning' : 'chip-success'}`}>
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
        className="input resize-y leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-caps">Insert</span>
        {TEMPLATE_INFO[templateKey].tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => insert(tag)}
            className="chip chip-primary min-h-[32px] hover:bg-primary/20"
          >
            <Icon name="add" size={14} />
            {`{${tag}}`}
          </button>
        ))}
      </div>
      {bad.length > 0 && (
        <p className="field-error">
          {`{${bad[0]}}`} isn’t a tag this message can use. Check the spelling.
        </p>
      )}
      {odd.length > 0 && (
        <p className="alert alert-warning">
          {odd.map((c) => `“${c}”`).join(' ')} {odd.length === 1 ? 'makes' : 'make'} each page hold
          only 70 characters, so the message costs more. Use plain quotes and write “NGN” or “N”
          instead of ₦ to avoid it.
        </p>
      )}
      <div className="rounded-tile bg-surface-2 p-4 text-sm">
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
          <h3 className="text-xl font-black">{info.title}</h3>
          <p className="text-[13px] text-muted">{info.schedule}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
          {enabled ? 'On' : 'Off'}
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-7 w-12 rounded-full bg-line-2 transition peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/25 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
        </label>
      </div>
      <p className="flex items-start gap-2 rounded-tile bg-surface-2 px-3.5 py-2.5 text-sm">
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
        <p role="alert" className="alert alert-danger">
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="alert alert-success">
          {state.message}
        </p>
      )}

      {testing ? (
        <div className="flex flex-wrap items-end gap-2 rounded-tile bg-surface-2 p-4">
          <label className="flex flex-1 flex-col gap-1.5 text-[13.5px] font-bold">
            Your phone number
            <input
              type="tel"
              inputMode="numeric"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="0803 000 0000"
              className="input font-normal"
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
    <section className={`${card} flex flex-col gap-3 border-coral/40`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="icon-tile tone-coral">
            <Icon name="schedule_send" size={22} />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold">Thank-you not sent for {day}</p>
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
        <p role="alert" className="alert alert-danger">
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="alert alert-success">
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
        <h2 className="text-2xl font-black">Recent sends</h2>
        <p className="text-[13px] text-muted">
          “Sent” means BulkSMS Nigeria accepted the message; it can’t tell us whether the phone
          received it.
        </p>
      </div>
      {runs.length === 0 ? (
        <p className={`${card} text-[15px] text-muted`}>Nothing has been sent yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              <tr>
                <th className="px-5 py-3.5 font-extrabold">When</th>
                <th className="px-5 py-3.5 font-extrabold">Message</th>
                <th className="px-5 py-3.5 text-right font-extrabold">Sent</th>
                <th className="px-5 py-3.5 text-right font-extrabold">Failed</th>
                <th className="px-5 py-3.5 text-right font-extrabold">Cost</th>
                <th className="px-5 py-3.5" />
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
        <td className="px-5 py-3.5 whitespace-nowrap">{when.format(new Date(run.lastAt))}</td>
        <td className="px-5 py-3.5">
          <span className="font-display font-extrabold">{title}</span>
          {run.provider === 'mock' && <span className="chip ml-2">Not really sent (SMS off)</span>}
        </td>
        <td className="px-5 py-3.5 text-right tabular-nums">{run.sent}</td>
        <td
          className={`px-4 py-3 text-right tabular-nums ${run.failed ? 'font-semibold text-danger' : ''}`}
        >
          {run.failed}
        </td>
        <td className="px-5 py-3.5 text-right tabular-nums">
          {run.cost ? naira.format(run.cost) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="btn btn-soft btn-sm"
          >
            {open ? 'Hide' : 'Who'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-surface-2 px-5 py-3.5">
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
                    <span
                      className={
                        p.status === 'sent' ? 'font-bold text-success' : 'font-bold text-danger'
                      }
                    >
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
