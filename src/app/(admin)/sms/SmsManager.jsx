'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { smsSegments, unicodeCharacters } from '@/lib/sms/segments';
import {
  AUDIENCES,
  BROADCAST_TAGS,
  TEMPLATE_INFO,
  renderTemplate,
  unknownTags,
} from '@/lib/sms/templates';

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

export default function SmsManager({ templates, invite, runs, audienceCounts }) {
  return (
    <>
      <Broadcast counts={audienceCounts} />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-black">Automatic messages</h2>
          <p className="card-sub">
            Sent without anyone pressing a button. Switch any of them off here.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          {templates.map((t) => (
            <TemplateEditor
              key={t.key}
              template={t}
              invite={t.key === 'saturday_invite' ? invite : null}
            />
          ))}
        </div>
      </section>

      <RunHistory runs={runs} />
    </>
  );
}

/** Message box with page count, tag buttons, spelling check on tags and a live preview. */
function MessageBox({ tagsFor, value, onChange, id, rows = 4 }) {
  const ref = useRef(null);
  const tags = tagsFor === 'broadcast' ? BROADCAST_TAGS : TEMPLATE_INFO[tagsFor].tags;
  const seg = smsSegments(renderTemplate(value, SAMPLE));
  const odd = unicodeCharacters(value);
  const bad = unknownTags(tagsFor, value);

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
        <label htmlFor={id} className="label-caps">
          Message
        </label>
        <span className={`chip ${seg.pages > 1 ? 'chip-warning' : 'chip-success'}`}>
          about {seg.length} characters · {seg.pages} {seg.pages === 1 ? 'page' : 'pages'}
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        maxLength={459}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input resize-y leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-caps">Insert</span>
        {tags.map((tag) => (
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
        <p className="field-error">{`{${bad[0]}}`} can’t be used here. Check the spelling.</p>
      )}
      {odd.length > 0 && (
        <p className="alert alert-warning">
          {odd.map((c) => `“${c}”`).join(' ')} {odd.length === 1 ? 'makes' : 'make'} each page hold
          only 70 characters, so the message costs more. Use plain quotes and write “NGN” or “N”
          instead of ₦.
        </p>
      )}
      <div className="rounded-tile bg-surface-2 p-4 text-sm">
        <p className="label-caps mb-1">Preview</p>
        {renderTemplate(value, SAMPLE)}
      </div>
    </div>
  );
}

/** "Send test to my phone" for any message. */
function TestSend({ templateKey, body, disabled, onDone }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await call('/api/sms/test', 'POST', { templateKey, phone, body: body.trim() });
      onDone({ kind: 'ok', message: 'Test sent. It should arrive within a minute.' });
      setOpen(false);
    } catch (err) {
      onDone({ kind: 'error', message: err.message });
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost">
        <Icon name="smartphone" size={18} />
        Send test to my phone
      </button>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-end gap-2 rounded-tile bg-surface-2 p-4">
      <label className="min-w-[180px] flex-1">
        <span className="field-label">Your phone number</span>
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0803 000 0000"
          className="input"
        />
      </label>
      <button
        type="button"
        onClick={send}
        disabled={!phone || disabled || busy}
        className="btn btn-primary"
      >
        <Icon name="send" size={18} />
        {busy ? 'Sending…' : 'Send test'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
        Cancel
      </button>
      <p className="w-full text-[12px] text-muted">
        Uses your first name in place of {'{FirstName}'}.
      </p>
    </div>
  );
}

function Status({ state }) {
  if (state.kind === 'error') {
    return (
      <p role="alert" className="alert alert-danger">
        <Icon name="error_outline" size={19} />
        {state.message}
      </p>
    );
  }
  if (state.kind === 'ok') {
    return (
      <p role="status" className="alert alert-success">
        <Icon name="check_circle" size={19} filled />
        {state.message}
      </p>
    );
  }
  return null;
}

/**
 * Send one message to a group. Steps: write → check (people, pages, sample) → send in
 * batches with a progress bar. If the connection drops, "Continue sending" picks up where it
 * stopped; nobody gets it twice.
 */
function Broadcast({ counts }) {
  const router = useRouter();
  const [audience, setAudience] = useState('members');
  const [body, setBody] = useState('Hi {FirstName}, ');
  const [step, setStep] = useState('write'); // write | check | sending | done
  const [preview, setPreview] = useState(null);
  const [job, setJob] = useState(null); // { id, total, processed, sent, failed, done }
  const [state, setState] = useState({ kind: 'idle' });
  const bad = unknownTags('broadcast', body).length > 0;

  async function check() {
    setState({ kind: 'busy' });
    try {
      setPreview(await call('/api/broadcasts?preview=1', 'POST', { audience, body: body.trim() }));
      setStep('check');
      setState({ kind: 'idle' });
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  async function sendAll(existing) {
    setStep('sending');
    setState({ kind: 'idle' });
    try {
      let current = existing;
      if (!current) {
        const created = await call('/api/broadcasts', 'POST', { audience, body: body.trim() });
        current = { id: created.id, total: created.total, processed: 0, sent: 0, failed: 0 };
        setJob(current);
      }
      while (!current.done) {
        current = await call(`/api/broadcasts/${current.id}`, 'POST');
        setJob(current);
      }
      setStep('done');
      router.refresh();
    } catch (err) {
      setState({
        kind: 'error',
        message: navigator.onLine
          ? err.message
          : 'The connection dropped. Press “Continue sending” when data returns — nobody gets it twice.',
      });
    }
  }

  const pct = job ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <section id="broadcast" className="card flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="icon-tile tone-coral h-12 w-12">
          <Icon name="send" size={24} />
        </span>
        <div>
          <h2 className="text-2xl font-black">Send a message</h2>
          <p className="card-sub">One SMS to a whole group, e.g. all members.</p>
        </div>
      </div>

      {step === 'write' && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="label-caps">Send to</span>
            <div role="tablist" aria-label="Send to" className="seg-tabs self-start">
              {Object.entries(AUDIENCES).map(([key, a]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={audience === key}
                  onClick={() => setAudience(key)}
                  className="seg-tab"
                >
                  {a.label}
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 font-sans text-xs font-bold text-ink-2">
                    {counts[key]}
                  </span>
                </button>
              ))}
            </div>
            <p className="px-1 text-[13px] text-muted">{AUDIENCES[audience].hint}</p>
            {audience === 'members' && counts.members === 0 && (
              <p className="alert alert-info">
                <Icon name="info" size={19} />
                <span>
                  No members yet.{' '}
                  <a href="/members" className="font-bold underline">
                    Upload your member list
                  </a>{' '}
                  first.
                </span>
              </p>
            )}
          </div>
          <MessageBox
            id="broadcast-message"
            tagsFor="broadcast"
            value={body}
            onChange={setBody}
            rows={5}
          />
          <Status state={state} />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <TestSend templateKey="broadcast" body={body} disabled={bad} onDone={setState} />
            <button
              type="button"
              onClick={check}
              disabled={bad || !body.trim() || !counts[audience] || state.kind === 'busy'}
              className="btn btn-primary btn-lg"
            >
              Check before sending
              <Icon name="arrow_forward" size={20} />
            </button>
          </div>
        </>
      )}

      {step === 'check' && preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Figure label="People" value={preview.count} />
            <Figure label="Pages each" value={preview.pages} />
            <Figure label="SMS units" value={preview.units} hint="People × pages" />
          </div>
          <div className="rounded-tile bg-surface-2 p-4 text-sm">
            <p className="label-caps mb-1">The longest message will read</p>
            {preview.sample}
          </div>
          <Status state={state} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setStep('write')} className="btn btn-ghost btn-lg">
              <Icon name="arrow_back" size={20} />
              Change it
            </button>
            <button type="button" onClick={() => sendAll(null)} className="btn btn-coral btn-lg">
              <Icon name="send" size={20} />
              Send to {preview.count} {preview.count === 1 ? 'person' : 'people'}
            </button>
          </div>
        </>
      )}

      {(step === 'sending' || step === 'done') && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-lg font-extrabold">
              {step === 'done' ? 'Sent' : 'Sending…'} {job?.processed ?? 0} of{' '}
              {job?.total ?? preview?.count}
            </p>
            {job && (
              <p className="text-sm text-muted">
                {job.sent} sent{job.failed ? ` · ${job.failed} failed` : ''}
              </p>
            )}
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <Status state={state} />
          {state.kind === 'error' && (
            <button
              type="button"
              onClick={() => (job ? sendAll(job) : setStep('check'))}
              className="btn btn-primary self-start"
            >
              <Icon name="refresh" size={18} />
              {job ? 'Continue sending' : 'Back'}
            </button>
          )}
          {step === 'done' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="alert alert-success flex-1">
                <Icon name="check_circle" size={19} filled />
                Done. {job?.failed ? 'Failed messages can be resent from Recent sends below.' : ''}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('write');
                  setJob(null);
                  setBody('Hi {FirstName}, ');
                }}
                className="btn btn-ghost"
              >
                Write another
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, hint }) {
  return (
    <div className="rounded-tile bg-surface-2 p-4">
      <p className="label-caps">{label}</p>
      <p className="font-display text-3xl font-black tabular-nums">{value}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

function TemplateEditor({ template, invite }) {
  const router = useRouter();
  const info = TEMPLATE_INFO[template.key];
  const [saved, setSaved] = useState({ body: template.body, enabled: template.enabled });
  const [body, setBody] = useState(template.body);
  const [enabled, setEnabled] = useState(template.enabled);
  const [state, setState] = useState({ kind: 'idle' });
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

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">{info.title}</h3>
          <p className="card-sub flex items-center gap-1">
            <Icon name="bolt" size={15} className="text-coral-strong" />
            {info.schedule}
          </p>
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
          <span className="relative h-7 w-12 rounded-full bg-line-2 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-primary/25" />
        </label>
      </div>
      <p className="flex items-start gap-2 rounded-tile bg-surface-2 px-3.5 py-2.5 text-sm">
        <Icon name="group" size={16} className="mt-0.5 text-muted" />
        <span>
          {info.recipients}
          {invite && (
            <strong className="mt-1 block text-ink">
              Next: {dayLabel.format(new Date(invite.serviceDate))} · {invite.toSend}{' '}
              {invite.toSend === 1 ? 'person' : 'people'}
            </strong>
          )}
        </span>
      </p>

      <MessageBox
        id={`message-${template.key}`}
        tagsFor={template.key}
        value={body}
        onChange={(v) => {
          setBody(v);
          setState({ kind: 'idle' });
        }}
      />
      <Status state={state} />
      <div className="mt-auto flex flex-wrap justify-between gap-2">
        <TestSend templateKey={template.key} body={body} disabled={bad} onDone={setState} />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || bad || !body.trim() || state.kind === 'busy'}
          className="btn btn-primary"
        >
          {dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>
    </section>
  );
}

const runTitle = (run) => {
  if (run.test) return 'Test messages';
  if (run.broadcast) {
    return `Message to ${AUDIENCES[run.broadcast.audience]?.label.toLowerCase() ?? 'a group'}`;
  }
  return TEMPLATE_INFO[run.template]?.title ?? run.template;
};

function RunHistory({ runs }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-black">Recent sends</h2>
        <p className="card-sub">
          “Sent” means BulkSMS Nigeria accepted the message; it can’t tell us whether the phone
          received it.
        </p>
      </div>
      {runs.length === 0 ? (
        <p className="card text-[15px] text-muted">Nothing has been sent yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              <tr>
                <th className="px-5 py-3.5">When</th>
                <th className="px-5 py-3.5">Message</th>
                <th className="px-5 py-3.5 text-right">Sent</th>
                <th className="px-5 py-3.5 text-right">Failed</th>
                <th className="px-5 py-3.5 text-right">Cost</th>
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [resend, setResend] = useState({ kind: 'idle' });

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

  async function retry() {
    setResend({ kind: 'busy' });
    try {
      const r = await call('/api/sms/resend', 'POST', { run: run.run });
      setResend({
        kind: 'ok',
        message: `Resent ${r.sent}${r.failed ? `, ${r.failed} failed again` : ''}`,
      });
      setPeople(null);
      router.refresh();
    } catch (err) {
      setResend({ kind: 'error', message: err.message });
    }
  }

  return (
    <>
      <tr>
        <td className="whitespace-nowrap px-5 py-3.5">{when.format(new Date(run.lastAt))}</td>
        <td className="px-5 py-3.5">
          <span className="font-display font-extrabold">{runTitle(run)}</span>
          {run.broadcast && (
            <span className="block max-w-[340px] truncate text-[13px] text-muted">
              {run.broadcast.body}
            </span>
          )}
        </td>
        <td className="px-5 py-3.5 text-right tabular-nums">{run.sent}</td>
        <td
          className={`px-5 py-3.5 text-right tabular-nums ${run.failed ? 'font-bold text-danger' : ''}`}
        >
          {run.failed}
        </td>
        <td className="px-5 py-3.5 text-right tabular-nums">
          {run.cost ? naira.format(run.cost) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right">
          <div className="flex justify-end gap-2">
            {run.failed > 0 && !run.test && (
              <button
                type="button"
                onClick={retry}
                disabled={resend.kind === 'busy'}
                className="btn btn-coral btn-sm"
              >
                {resend.kind === 'busy' ? 'Resending…' : 'Resend failed'}
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="btn btn-soft btn-sm"
            >
              {open ? 'Hide' : 'Who'}
            </button>
          </div>
          {(resend.kind === 'ok' || resend.kind === 'error') && (
            <p
              className={`mt-1 text-[12px] ${resend.kind === 'error' ? 'text-danger' : 'text-success'}`}
            >
              {resend.message}
            </p>
          )}
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
