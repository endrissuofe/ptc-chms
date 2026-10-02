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
  MAX_WORDINGS,
  renderTemplate,
  unknownTags,
} from '@/lib/sms/templates';

const SAMPLE = {
  FirstName: 'Chinedu',
  LastName: 'Okafor',
  ChurchName: 'Ptchapel',
  ServiceTimes: 'Service starts at 8:00 AM.',
  Link: 'https://ptc-chms.vercel.app/c/Ab3dE9xY',
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

// The Onefold buttons have no disabled look of their own yet.
const OFF =
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-of-accent/40';

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

/** `admin` adds what pastors don't get: the automatic messages' wordings and resending. */
export default function SmsManager({
  templates,
  invite,
  memberInvite,
  runs,
  audienceCounts,
  admin = false,
}) {
  const previews = { saturday_invite: invite, member_invite: memberInvite };
  return (
    <>
      <Broadcast counts={audienceCounts} />

      {admin && (
        <section aria-labelledby="automatic-title" className="flex flex-col gap-3">
          <div>
            <h2 id="automatic-title" className="of-h2">
              Automatic messages
            </h2>
            <p className="text-meta text-muted">
              Sent by the app on their own. Open one to see who gets it or change the wording.
            </p>
          </div>
          <ul className="of-panel divide-y divide-line">
            {templates.map((t) => (
              <TemplateEditor key={t.key} template={t} invite={previews[t.key] ?? null} />
            ))}
          </ul>
        </section>
      )}

      <RunHistory runs={runs} admin={admin} />
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
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="of-eyebrow">
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
        className="input resize-y leading-relaxed focus:border-of-accent focus:ring-of-accent/30"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="of-eyebrow">Insert</span>
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
          <summary className={`of-link cursor-pointer list-none ${FOCUS}`}>
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
          <p className="of-eyebrow">Preview</p>
          {preview}
        </div>
      )}
    </div>
  );
}

const STEPS = ['Write', 'Check', 'Send'];

/** Where the broadcast is: write → check → send. */
function Steps({ step }) {
  const at = { write: 0, check: 1, sending: 2, done: 3 }[step];
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === at ? 'step' : undefined}
          className={`flex items-center gap-1.5 ${i === at ? 'font-semibold text-ink' : 'text-muted'}`}
        >
          {i > 0 && <span aria-hidden="true" className="h-px w-3 bg-line-2" />}
          <span
            aria-hidden="true"
            className={`grid h-6 w-6 place-items-center rounded-full text-2xs font-semibold tabular-nums ${
              i < at
                ? 'bg-of-accent text-of-on-accent'
                : i === at
                  ? 'bg-of-accent-soft text-of-accent-ink'
                  : 'bg-surface-2'
            }`}
          >
            {i < at ? <Icon name="check" size={14} /> : i + 1}
          </span>
          {label}
          {i < at && <span className="sr-only"> (done)</span>}
        </li>
      ))}
    </ol>
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
    <section
      id="broadcast"
      aria-labelledby="broadcast-title"
      className="of-panel flex scroll-mt-24 flex-col gap-5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 id="broadcast-title" className="of-h2">
            Send a message
          </h2>
          <p className="text-meta text-muted">One SMS to a whole group, such as all members.</p>
        </div>
        <Steps step={step} />
      </div>

      {step === 'write' && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="of-eyebrow">Send to</span>
            <div
              role="group"
              aria-label="Send to"
              className="of-tabs max-w-full self-start overflow-x-auto"
            >
              {Object.entries(AUDIENCES).map(([key, a]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={audience === key}
                  onClick={() => setAudience(key)}
                  className="of-tab shrink-0"
                >
                  {a.label}
                  <span className="of-count">{counts[key]}</span>
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
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={check}
              disabled={bad || !body.trim() || !counts[audience]}
              aria-disabled={state.kind === 'busy'}
              className={`of-btn ${OFF}`}
            >
              <Busy
                busy={state.kind === 'busy'}
                busyLabel="Checking…"
                label="Check before sending"
              />
              {state.kind !== 'busy' && <Icon name="arrow_forward" size={18} />}
            </button>
          </div>
        </>
      )}

      {step === 'check' && preview && (
        <>
          <dl className="grid grid-cols-3 divide-x divide-line border-y border-line py-4">
            <Figure label="People" value={preview.count} />
            <Figure label="Pages each" value={preview.pages} />
            <Figure label="SMS units" value={preview.units} hint="People × pages" />
          </dl>
          <div className="flex flex-col gap-1">
            <p className="of-eyebrow">The longest message will read</p>
            <div className="rounded-tile bg-surface-2 p-4 text-sm">{preview.sample}</div>
          </div>
          {state.kind === 'error' && <FormAlert error={state.error} />}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setStep('write')} className="of-btn-quiet">
              <Icon name="arrow_back" size={18} />
              Change it
            </button>
            <button type="button" onClick={() => sendAll(null)} className="of-btn">
              <Icon name="send" size={18} />
              Send to {preview.count} {preview.count === 1 ? 'person' : 'people'}
            </button>
          </div>
        </>
      )}

      {(step === 'sending' || step === 'done') && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-brand text-lg font-semibold">
              {step === 'done' ? 'Sent' : 'Sending…'} {job?.processed ?? 0} of{' '}
              {job?.total ?? preview?.count}
            </p>
            {job && (
              <p className="text-meta text-muted">
                {job.sent} sent
                {job.failed ? (
                  <span className="font-semibold text-danger"> · {job.failed} failed</span>
                ) : (
                  ''
                )}
              </p>
            )}
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Sending progress"
          >
            <div
              className="h-full rounded-full bg-of-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {state.kind === 'error' && <FormAlert error={state.error} />}
          {state.kind === 'error' && (
            <button
              type="button"
              onClick={() => (job ? sendAll(job) : setStep('check'))}
              className="of-btn self-start"
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
                className="of-btn-quiet"
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
    <div className="flex min-w-0 flex-col gap-1 px-3 first:pl-0 sm:px-5">
      <dt className="of-eyebrow">{label}</dt>
      <dd className="of-figure text-[2rem]">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

/** One automatic message as a row: name, when it goes and an on/off switch; opens to edit. */
function TemplateEditor({ template, invite }) {
  const router = useRouter();
  const info = TEMPLATE_INFO[template.key];
  const rotates = Boolean(info.rotates);
  const initial = template.bodies ?? [template.body];
  const [saved, setSaved] = useState({ bodies: initial, enabled: template.enabled });
  const [bodies, setBodies] = useState(initial);
  const [enabled, setEnabled] = useState(template.enabled);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ kind: 'idle' });
  const trimmed = bodies.map((b) => b.trim());
  const dirty =
    JSON.stringify(trimmed) !== JSON.stringify(saved.bodies) || enabled !== saved.enabled;
  const bad = trimmed.some((b) => !b || unknownTags(template.key, b).length > 0);
  const busy = state.kind === 'busy';
  const body = bodies[0];
  const panelId = `sms-${template.key}-panel`;
  const setBody = (v) => setBodies((list) => [v, ...list.slice(1)]);
  const setWording = (i) => (v) => {
    setBodies((list) => list.map((b, j) => (j === i ? v : b)));
    setState({ kind: 'idle' });
  };

  async function save() {
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      const doc = await sendJson(
        `/api/sms/templates?key=${template.key}`,
        'PATCH',
        rotates ? { bodies: trimmed, enabled } : { body: trimmed[0], enabled },
      );
      const next = rotates ? [doc.body, ...(doc.variants ?? [])] : [doc.body];
      setSaved({ bodies: next, enabled: doc.enabled });
      setBodies(next);
      setState({ kind: 'ok', message: 'Changes saved.' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <li>
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-tile px-2 py-1.5 text-left transition-colors hover:bg-surface-2 ${FOCUS}`}
        >
          <Icon
            name="expand_more"
            size={20}
            className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold">{info.title}</span>
              {dirty && <span className="chip chip-warning">Not saved</span>}
            </span>
            <span className="block text-meta text-muted">
              {info.schedule}
              {rotates && ` · ${bodies.length} ${bodies.length === 1 ? 'wording' : 'wordings'}`}
            </span>
            {invite && (
              <span className="block text-meta font-semibold text-ink-2">
                Next: {dayLabel.format(new Date(invite.serviceDate))} · {invite.toSend}{' '}
                {invite.toSend === 1 ? 'person' : 'people'}
              </span>
            )}
          </span>
        </button>
        <label className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
          <span className={enabled ? 'text-ink' : 'text-muted'}>{enabled ? 'On' : 'Off'}</span>
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setState({ kind: 'idle' });
              // The switch is saved with the wording, so show the Save button.
              setOpen(true);
            }}
            aria-label={`${info.title}: ${enabled ? 'on' : 'off'}`}
            className="switch"
          />
        </label>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className={`${open ? 'flex' : 'hidden'} flex-col gap-4 border-t border-line px-5 pb-5 pt-4 motion-safe:animate-fade-in sm:px-6`}
      >
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <Icon name="group" size={16} className="mt-0.5 text-muted" />
          <span>{info.recipients}</span>
        </p>

        {rotates ? (
          <ol className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
            {bodies.map((b, i) => (
              <li key={i} className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    Wording {i + 1}
                    {i === template.nextWording && (
                      <span className="chip bg-of-accent-soft text-of-accent-ink">
                        This Saturday
                      </span>
                    )}
                  </span>
                  {bodies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBodies((list) => list.filter((_, j) => j !== i));
                        setState({ kind: 'idle' });
                      }}
                      aria-label={`Remove wording ${i + 1}`}
                      className="icon-btn"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
                <MessageBox
                  id={`message-${template.key}-${i}`}
                  tagsFor={template.key}
                  value={b}
                  foldPreview
                  onChange={setWording(i)}
                />
              </li>
            ))}
            {bodies.length < MAX_WORDINGS && (
              <li className="lg:col-span-2">
                <button
                  type="button"
                  onClick={() => setBodies((list) => [...list, ''])}
                  className="of-btn-quiet"
                >
                  <Icon name="add" size={16} />
                  Add a wording
                </button>
              </li>
            )}
          </ol>
        ) : (
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
        )}
        {state.kind === 'error' && <FormAlert error={state.error} />}
        {state.kind === 'ok' && !dirty && <FormAlert success={state.message} />}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty ? (
            <button
              type="button"
              onClick={save}
              disabled={bad}
              aria-disabled={busy}
              className={`of-btn ${OFF}`}
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
      </div>
    </li>
  );
}

const runTitle = (run) => {
  if (run.test) return 'Test messages';
  if (run.broadcast) {
    return `Message to ${AUDIENCES[run.broadcast.audience]?.label.toLowerCase() ?? 'a group'}`;
  }
  return TEMPLATE_INFO[run.template]?.title ?? run.template;
};

function RunHistory({ runs, admin }) {
  const failed = runs.filter((r) => r.failed > 0 && !r.test).length;
  return (
    <section aria-labelledby="runs-title" className="flex flex-col gap-3">
      <div>
        <h2 id="runs-title" className="of-h2">
          Recent sends
        </h2>
        {runs.length > 0 && (
          <p className="text-meta text-muted">
            {failed
              ? `${failed} ${failed === 1 ? 'send has' : 'sends have'} failed messages you can resend`
              : 'Nothing failed'}
          </p>
        )}
      </div>
      {runs.length === 0 ? (
        <EmptyState
          card
          icon="sms"
          title="Nothing has been sent yet"
          action={{ href: '#broadcast', label: 'Send a message', icon: 'send' }}
        />
      ) : (
        <div className="of-panel relative overflow-x-auto">
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
                <RunRow key={r.run} run={r} admin={admin} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RunRow({ run, admin }) {
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
        <td className="whitespace-nowrap pl-5 text-muted">{when.format(new Date(run.lastAt))}</td>
        <td>
          <span className="font-semibold">{runTitle(run)}</span>
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
          <div className="flex justify-end gap-1">
            {admin && run.failed > 0 && !run.test && (
              <button
                type="button"
                onClick={retry}
                aria-disabled={resend.kind === 'busy'}
                className={`of-btn-quiet ${OFF}`}
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
            <button type="button" onClick={toggle} aria-expanded={open} className="of-link px-2">
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
                <button type="button" onClick={load} className="of-link">
                  Try again
                </button>
              </p>
            ) : !people ? (
              <p className="flex items-center gap-2 text-muted">
                <Icon name="sync" size={16} className="motion-safe:animate-spin" />
                Loading…
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line motion-safe:animate-fade-in">
                {people.map((p, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3 py-1.5">
                    <span className="font-semibold">{p.name}</span>
                    <span className="tabular-nums text-muted">{p.to}</span>
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
