'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import EmptyState from '@/components/ui/EmptyState';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
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

/** The SMS company's reasons, in words a church admin can act on. */
function plainReason(error = '') {
  if (/insufficient|balance|credit|unit/i.test(error)) return 'Not enough SMS credit';
  if (/unauth|api key|token|401/i.test(error))
    return 'The SMS company rejected our login (API key)';
  if (/sender/i.test(error)) return 'Sender name not accepted';
  if (/recipient|invalid (phone|number)|-6/i.test(error)) return 'Phone number not accepted';
  if (/http|fetch|timeout|econn|network|5\d\d/i.test(error))
    return 'Couldn’t reach the SMS company';
  return error || 'Unknown reason';
}

export default function SmsManager({ templates, invite, runs, audienceCounts }) {
  return (
    <>
      <Broadcast counts={audienceCounts} />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="section-title">Automatic messages</h2>
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

/** Message box with page count, tag buttons, spelling check on tags and a preview. */
function MessageBox({ tagsFor, value, onChange, id, rows = 4, foldPreview = false }) {
  const ref = useRef(null);
  const tags = tagsFor === 'broadcast' ? BROADCAST_TAGS : TEMPLATE_INFO[tagsFor].tags;
  const seg = smsSegments(renderTemplate(value, SAMPLE));
  const odd = unicodeCharacters(value);
  const bad = unknownTags(tagsFor, value);
  const errorId = `${id}-error`;

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

  const preview = (
    <div className="rounded-tile bg-surface-2 p-4 text-sm">{renderTemplate(value, SAMPLE)}</div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        aria-invalid={bad.length ? true : undefined}
        aria-describedby={bad.length ? errorId : undefined}
        className="input resize-y leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-caps">Insert</span>
        {tags.map((tag) => (
          <button key={tag} type="button" onClick={() => insert(tag)} className="chip-btn">
            <Icon name="add" size={15} />
            {`{${tag}}`}
          </button>
        ))}
      </div>
      <FieldError id={errorId}>
        {bad.length > 0 && `{${bad[0]}} can’t be used here. Check the spelling.`}
      </FieldError>
      {odd.length > 0 && (
        <p className="alert alert-warning">
          <Icon name="info" size={19} />
          <span>
            {odd.map((c) => `“${c}”`).join(' ')} {odd.length === 1 ? 'makes' : 'make'} each page
            hold only 70 characters, so the message costs more. Use plain quotes and write “NGN” or
            “N” instead of ₦.
          </span>
        </p>
      )}
      {foldPreview ? (
        <details className="group">
          <summary className="tap-link cursor-pointer list-none text-sm text-primary">
            <Icon
              name="expand_more"
              size={18}
              className="transition-transform group-open:rotate-180"
            />
            Preview
          </summary>
          <div className="mt-1 motion-safe:animate-fade-in">{preview}</div>
        </details>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="label-caps">Preview</p>
          {preview}
        </div>
      )}
    </div>
  );
}

/** "Send test to my phone" for any message. Errors show under the phone box. */
function TestSend({ templateKey, body, disabled }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [state, setState] = useState({ kind: 'idle' });
  const inputRef = useRef(null);
  const busy = state.kind === 'busy';
  const errorId = `test-${templateKey}-error`;

  async function send() {
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/sms/test', 'POST', { templateKey, phone, body: body.trim() });
      setState({ kind: 'ok', message: 'Test sent. It should arrive within a minute.' });
    } catch (err) {
      setState({ kind: 'error', error: err });
      inputRef.current?.focus();
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="btn btn-ghost self-start"
        >
          <Icon name="smartphone" size={18} />
          Send test to my phone
        </button>
        {state.kind === 'ok' && <FormAlert success={state.message} />}
      </div>
    );
  }
  const phoneError = state.kind === 'error' ? state.error.fields?.phone : null;
  return (
    <div
      className="flex w-full flex-col gap-3 rounded-tile bg-surface-2 p-4 motion-safe:animate-fade-in"
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <label className="flex flex-col">
        <span className="field-label">Your phone number</span>
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setState({ kind: 'idle' });
          }}
          placeholder="e.g. 0803 000 0000"
          aria-invalid={phoneError ? true : undefined}
          aria-describedby={phoneError ? errorId : undefined}
          className="input"
        />
        <FieldError id={errorId}>{phoneError}</FieldError>
        <span className="field-hint">Uses your first name in place of {'{FirstName}'}.</span>
      </label>
      {state.kind === 'error' && !phoneError && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={send}
          disabled={!phone || disabled}
          aria-disabled={busy}
          className="btn btn-primary"
        >
          <Busy busy={busy} busyLabel="Sending…" icon="send" label="Send test" />
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
          Close
        </button>
      </div>
    </div>
  );
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
  // A double tap on a slow phone must never start the same broadcast twice.
  const sending = useRef(false);
  const bad = unknownTags('broadcast', body).length > 0;

  async function check() {
    if (state.kind === 'busy') return;
    setState({ kind: 'busy' });
    try {
      setPreview(
        await sendJson('/api/broadcasts?preview=1', 'POST', { audience, body: body.trim() }),
      );
      setStep('check');
      setState({ kind: 'idle' });
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  async function sendAll(existing) {
    if (sending.current) return;
    sending.current = true;
    setStep('sending');
    setState({ kind: 'idle' });
    try {
      let current = existing;
      if (!current) {
        const created = await sendJson('/api/broadcasts', 'POST', { audience, body: body.trim() });
        current = { id: created.id, total: created.total, processed: 0, sent: 0, failed: 0 };
        setJob(current);
      }
      while (!current.done) {
        current = await sendJson(`/api/broadcasts/${current.id}`, 'POST');
        setJob(current);
      }
      setStep('done');
      router.refresh();
    } catch (err) {
      setState({
        kind: 'error',
        error: navigator.onLine
          ? err
          : {
              message:
                'The connection dropped. Press “Continue sending” when data returns — nobody gets it twice.',
            },
      });
    } finally {
      sending.current = false;
    }
  }

  const pct = job ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <section id="broadcast" className="card flex scroll-mt-24 flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="icon-tile tone-coral h-12 w-12">
          <Icon name="send" size={24} />
        </span>
        <div>
          <h2 className="section-title">Send a message</h2>
          <p className="card-sub">One SMS to a whole group, e.g. all members.</p>
        </div>
      </div>

      {step === 'write' && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="label-caps">Send to</span>
            <div role="group" aria-label="Send to" className="seg-tabs self-start">
              {Object.entries(AUDIENCES).map(([key, a]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={audience === key}
                  onClick={() => setAudience(key)}
                  className="seg-tab"
                >
                  {a.label}
                  <span className="seg-count">{counts[key]}</span>
                </button>
              ))}
            </div>
            <p className="px-1 text-meta text-muted">{AUDIENCES[audience].hint}</p>
            {audience === 'members' && counts.members === 0 && (
              <p className="alert alert-info">
                <Icon name="info" size={19} />
                <span>
                  No members yet.{' '}
                  <Link href="/members" className="font-bold underline">
                    Upload your member list
                  </Link>{' '}
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
          {state.kind === 'error' && <FormAlert error={state.error} />}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <TestSend templateKey="broadcast" body={body} disabled={bad} />
            <button
              type="button"
              onClick={check}
              disabled={bad || !body.trim() || !counts[audience]}
              aria-disabled={state.kind === 'busy'}
              className="btn btn-primary btn-lg"
            >
              <Busy
                busy={state.kind === 'busy'}
                busyLabel="Checking…"
                label="Check before sending"
              />
              {state.kind !== 'busy' && <Icon name="arrow_forward" size={20} />}
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
          <div className="flex flex-col gap-1">
            <p className="label-caps">The longest message will read</p>
            <div className="rounded-tile bg-surface-2 p-4 text-sm">{preview.sample}</div>
          </div>
          {state.kind === 'error' && <FormAlert error={state.error} />}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setStep('write')} className="btn btn-ghost btn-lg">
              <Icon name="arrow_back" size={20} />
              Change it
            </button>
            <button type="button" onClick={() => sendAll(null)} className="btn btn-primary btn-lg">
              <Icon name="send" size={20} />
              Send to {preview.count} {preview.count === 1 ? 'person' : 'people'}
            </button>
          </div>
        </>
      )}

      {(step === 'sending' || step === 'done') && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
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
          <div
            className="h-3 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Sending progress"
          >
            <div
              className="h-full rounded-full bg-primary-fill transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {state.kind === 'error' && <FormAlert error={state.error} />}
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
              <FormAlert
                className="flex-1"
                success={`Done.${job?.failed ? ' Failed messages can be resent from Recent sends below.' : ''}`}
              />
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
      <p className="stat-value mt-1">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
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
  const busy = state.kind === 'busy';

  async function save() {
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      const doc = await sendJson(`/api/sms/templates?key=${template.key}`, 'PATCH', {
        body: body.trim(),
        enabled,
      });
      setSaved({ body: doc.body, enabled: doc.enabled });
      setBody(doc.body);
      setState({ kind: 'ok', message: 'Changes saved.' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="card-title">{info.title}</h3>
          <p className="card-sub flex items-center gap-1">
            <Icon name="bolt" size={15} className="text-coral-ink" />
            {info.schedule}
          </p>
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
          {enabled ? 'On' : 'Off'}
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setState({ kind: 'idle' });
            }}
            aria-label={`${info.title}: ${enabled ? 'on' : 'off'}`}
            className="switch"
          />
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
        foldPreview
        onChange={(v) => {
          setBody(v);
          setState({ kind: 'idle' });
        }}
      />
      {state.kind === 'error' && <FormAlert error={state.error} />}
      {state.kind === 'ok' && !dirty && <FormAlert success={state.message} />}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <TestSend templateKey={template.key} body={body} disabled={bad} />
        {dirty ? (
          <button
            type="button"
            onClick={save}
            disabled={bad || !body.trim()}
            aria-disabled={busy}
            className="btn btn-primary"
          >
            <Busy busy={busy} icon="save" label="Save changes" />
          </button>
        ) : (
          state.kind !== 'ok' && (
            <span className="chip chip-success">
              <Icon name="check" size={14} />
              Saved
            </span>
          )
        )}
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
        <h2 className="section-title">Recent sends</h2>
        <p className="card-sub">
          “Sent” means our SMS company accepted the message; it can’t tell us whether the phone
          received it.
        </p>
      </div>
      {runs.length === 0 ? (
        <EmptyState
          card
          icon="sms"
          title="Nothing has been sent yet"
          action={{ href: '#broadcast', label: 'Send a message', icon: 'send' }}
        />
      ) : (
        <div className="relative overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
          <table className="table min-w-[680px]">
            <thead>
              <tr>
                <th scope="col" className="pl-5">
                  When
                </th>
                <th scope="col">Message</th>
                <th scope="col" className="text-right">
                  Sent
                </th>
                <th scope="col" className="text-right">
                  Failed
                </th>
                <th scope="col" className="text-right">
                  Cost
                </th>
                <th scope="col" className="pr-5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
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
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  const [resend, setResend] = useState({ kind: 'idle' });

  async function load() {
    setError(null);
    try {
      const data = await sendJson(`/api/sms/logs?run=${encodeURIComponent(run.run)}`, 'GET');
      setPeople(data.items);
    } catch (err) {
      setError(err);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !people) load();
  }

  async function retry() {
    if (resend.kind === 'busy') return;
    const ok = await confirm({
      title: `Resend ${run.failed} failed ${run.failed === 1 ? 'message' : 'messages'}?`,
      body: 'This uses SMS credit again for each one.',
      confirmLabel: 'Resend',
      icon: 'send',
    });
    if (!ok) return;
    setResend({ kind: 'busy' });
    try {
      const r = await sendJson('/api/sms/resend', 'POST', { run: run.run });
      setResend({
        kind: 'ok',
        message: `Resent ${r.sent}${r.failed ? `, ${r.failed} failed again` : ''}.`,
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
        <td className="whitespace-nowrap pl-5">{when.format(new Date(run.lastAt))}</td>
        <td>
          <span className="font-display font-extrabold">{runTitle(run)}</span>
          {run.broadcast && (
            <span className="block max-w-[340px] truncate text-meta text-muted">
              {run.broadcast.body}
            </span>
          )}
        </td>
        <td className="text-right tabular-nums">{run.sent}</td>
        <td className={`text-right tabular-nums ${run.failed ? 'font-bold text-danger' : ''}`}>
          {run.failed}
        </td>
        <td className="text-right tabular-nums">{run.cost ? naira.format(run.cost) : '—'}</td>
        <td className="pr-5 text-right">
          <div className="flex justify-end gap-2">
            {run.failed > 0 && !run.test && (
              <button
                type="button"
                onClick={retry}
                aria-disabled={resend.kind === 'busy'}
                className="btn btn-soft btn-sm"
              >
                <Busy
                  busy={resend.kind === 'busy'}
                  busyLabel="Resending…"
                  icon="send"
                  label="Resend failed"
                  size={16}
                />
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="btn btn-ghost btn-sm"
            >
              {open ? 'Hide' : 'See who'}
            </button>
          </div>
          {(resend.kind === 'ok' || resend.kind === 'error') && (
            <p
              role="status"
              className={`mt-1 text-xs font-semibold ${resend.kind === 'error' ? 'text-danger' : 'text-success'}`}
            >
              {resend.message}
            </p>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-surface-2 px-5">
            {error ? (
              <p className="flex flex-wrap items-center gap-2 text-danger">
                {error.message}
                <button type="button" onClick={load} className="tap-link text-primary">
                  Try again
                </button>
              </p>
            ) : !people ? (
              <p className="flex items-center gap-2 text-muted">
                <Icon name="sync" size={16} className="motion-safe:animate-spin" />
                Loading…
              </p>
            ) : (
              <ul className="flex flex-col gap-1 motion-safe:animate-fade-in">
                {people.map((p, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-muted">{p.to}</span>
                    <span
                      className={
                        p.status === 'sent' ? 'font-bold text-success' : 'font-bold text-danger'
                      }
                    >
                      {p.status === 'sent' ? 'Sent' : `Not sent: ${plainReason(p.error)}`}
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
