'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import EmptyState from '@/components/ui/EmptyState';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { formatMoment } from '@/lib/format';

const toList = (text) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

export default function AlertsManager({ settings, report, email, recent }) {
  return (
    <>
      <Recipients settings={settings} />
      <Preview
        report={report}
        email={email}
        hasRecipients={settings.followupEmails.length + settings.pastorEmails.length > 0}
      />
      <History recent={recent} />
    </>
  );
}

function Recipients({ settings }) {
  const router = useRouter();
  const [followup, setFollowup] = useState(settings.followupEmails.join('\n'));
  const [pastors, setPastors] = useState(settings.pastorEmails.join('\n'));
  const [on, setOn] = useState(settings.followUpReport);
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy';

  // Zod reports list errors as followupEmails.<index>; show them under the right box.
  const issues = state.kind === 'error' ? (state.error.details ?? []) : [];
  const listError = (key, list) => {
    const issue = Array.isArray(issues) ? issues.find((i) => i.path?.[0] === key) : null;
    if (!issue) return null;
    const bad = list[issue.path?.[1]];
    return bad ? `“${bad}” isn’t a valid email address` : issue.message;
  };
  const followupList = toList(followup);
  const pastorList = toList(pastors);
  const followupError = listError('followupEmails', followupList);
  const pastorError = listError('pastorEmails', pastorList);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      const saved = await sendJson('/api/alerts', 'PATCH', {
        followupEmails: followupList,
        pastorEmails: pastorList,
        followUpReport: on,
      });
      setFollowup(saved.followupEmails.join('\n'));
      setPastors(saved.pastorEmails.join('\n'));
      setState({ kind: 'ok', message: 'Saved.' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="icon-tile tone-primary">
            <Icon name="group" size={22} />
          </span>
          <div>
            <h2 className="card-title">Who gets the morning email</h2>
            <p className="card-sub">One email address per line.</p>
          </div>
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
          {on ? 'On' : 'Off'}
          <input
            type="checkbox"
            role="switch"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            aria-label={`Morning follow-up email: ${on ? 'on' : 'off'}`}
            className="switch"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col">
          <span className="field-label">
            <span className="flex items-center gap-1.5">
              <Icon name="call" size={17} className="text-muted" />
              Follow-up team
            </span>
            <span className="font-semibold text-muted">{followupList.length}</span>
          </span>
          <textarea
            rows={5}
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            placeholder={'e.g. followup@gmail.com'}
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={followupError ? true : undefined}
            aria-describedby={followupError ? 'followup-error' : undefined}
            className="input resize-y"
          />
          <FieldError id="followup-error">{followupError}</FieldError>
        </label>
        <label className="flex flex-col">
          <span className="field-label">
            <span className="flex items-center gap-1.5">
              <Icon name="church" size={17} className="text-muted" />
              Pastors (copied in)
            </span>
            <span className="font-semibold text-muted">{pastorList.length}</span>
          </span>
          <textarea
            rows={5}
            value={pastors}
            onChange={(e) => setPastors(e.target.value)}
            placeholder={'e.g. pastor@gmail.com'}
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={pastorError ? true : undefined}
            aria-describedby={pastorError ? 'pastor-error' : undefined}
            className="input resize-y"
          />
          <FieldError id="pastor-error">{pastorError}</FieldError>
        </label>
      </div>

      {state.kind === 'error' && !followupError && !pastorError && (
        <FormAlert error={state.error} />
      )}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
      <button type="submit" aria-disabled={busy} className="btn btn-primary self-start">
        <Busy busy={busy} icon="save" label="Save" />
      </button>
    </form>
  );
}

function Preview({ report, email, hasRecipients }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [testTo, setTestTo] = useState('');
  const [test, setTest] = useState({ kind: 'idle' });
  const [send, setSend] = useState({ kind: 'idle' });

  async function sendTest(e) {
    e.preventDefault();
    if (test.kind === 'busy') return;
    setTest({ kind: 'busy' });
    try {
      await sendJson('/api/alerts/test', 'POST', { to: testTo });
      setTest({ kind: 'ok', message: `Test email sent to ${testTo}. Check the inbox (and spam).` });
      router.refresh();
    } catch (err) {
      setTest({ kind: 'error', error: err });
    }
  }

  async function sendNow() {
    if (send.kind === 'busy') return;
    const ok = await confirm({
      title: 'Send this report now?',
      body: 'It goes to everyone on the lists above. Tomorrow’s 7 AM email still goes out as usual.',
      confirmLabel: 'Send now',
      icon: 'send',
    });
    if (!ok) return;
    setSend({ kind: 'busy' });
    try {
      const r = await sendJson('/api/alerts/send', 'POST');
      setSend(
        r.sent
          ? {
              kind: 'ok',
              message: `Sent to ${r.to + r.cc} ${r.to + r.cc === 1 ? 'person' : 'people'}.`,
            }
          : { kind: 'error', error: { message: r.error || `Not sent: ${r.skipped}.` } },
      );
      router.refresh();
    } catch (err) {
      setSend({ kind: 'error', error: err });
    }
  }

  const testError = test.kind === 'error' ? test.error.fields?.to : null;
  return (
    <section className="card flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="icon-tile tone-coral">
          <Icon name="forward_to_inbox" size={22} />
        </span>
        <div>
          <h2 className="card-title">Tomorrow morning’s email</h2>
          <p className="card-sub">
            {report.firstTimers.length} first {report.firstTimers.length === 1 ? 'timer' : 'timers'}{' '}
            and {report.returning.length} returning today · {report.overdue.length} waiting over 72
            hours
          </p>
        </div>
      </div>

      {email ? (
        <div className="overflow-hidden rounded-tile border border-line">
          <p className="border-b border-line bg-surface-2 px-4 py-3 text-sm">
            <span className="label-caps mr-2">Subject</span>
            <strong>{email.subject}</strong>
          </p>
          <iframe
            title="Email preview"
            srcDoc={email.html}
            sandbox=""
            className="h-[480px] w-full bg-[#faf7f2]"
          />
        </div>
      ) : (
        <EmptyState icon="task_alt" tone="tone-success" title="Nothing to report right now">
          No new first timers today and nobody waiting over 72 hours, so no email would go out.
        </EmptyState>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={sendTest} className="flex flex-col gap-2 rounded-tile bg-surface-2 p-4">
          <label htmlFor="test-to" className="field-label">
            Send a test email
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="test-to"
              type="email"
              value={testTo}
              onChange={(e) => {
                setTestTo(e.target.value);
                setTest({ kind: 'idle' });
              }}
              required
              placeholder="your@email.com"
              autoCapitalize="none"
              aria-invalid={testError ? true : undefined}
              aria-describedby={testError ? 'test-to-error' : undefined}
              className="input min-w-[12rem] flex-1"
            />
            <button type="submit" aria-disabled={test.kind === 'busy'} className="btn btn-soft">
              <Busy
                busy={test.kind === 'busy'}
                busyLabel="Sending…"
                icon="send"
                label="Send test"
              />
            </button>
          </div>
          <FieldError id="test-to-error">{testError}</FieldError>
          {test.kind === 'error' && !testError && <FormAlert error={test.error} />}
          {test.kind === 'ok' && <FormAlert success={test.message} />}
        </form>
        <div className="flex flex-col gap-2 rounded-tile bg-surface-2 p-4">
          <p className="field-label">Send this report now</p>
          <p className="field-hint mt-0">For trying it out. Goes to everyone on the lists above.</p>
          <button
            type="button"
            onClick={sendNow}
            disabled={!email || !hasRecipients}
            aria-disabled={send.kind === 'busy'}
            className="btn btn-primary self-start"
          >
            <Busy busy={send.kind === 'busy'} busyLabel="Sending…" icon="send" label="Send now" />
          </button>
          {!hasRecipients && <p className="field-hint">Add at least one email address first.</p>}
          {send.kind === 'error' && <FormAlert error={send.error} />}
          {send.kind === 'ok' && <FormAlert success={send.message} />}
        </div>
      </div>
    </section>
  );
}

function History({ recent }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">Recent emails</h2>
      {recent.length === 0 ? (
        <EmptyState card icon="mail" title="No emails sent yet">
          The first one goes out tomorrow at 7 AM, or send a test above.
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
          <table className="table min-w-[560px]">
            <thead>
              <tr>
                <th scope="col" className="pl-5">
                  When
                </th>
                <th scope="col">Email</th>
                <th scope="col" className="text-right">
                  People
                </th>
                <th scope="col" className="pr-5">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap pl-5">{formatMoment(e.at)}</td>
                  <td>
                    <span className="font-semibold">
                      {e.kind === 'test' ? 'Test email' : e.subject}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{e.to}</td>
                  <td className="pr-5">
                    <span
                      className={`chip ${e.status === 'sent' ? 'chip-success' : 'chip-danger'}`}
                    >
                      {e.status === 'sent' ? 'Sent' : 'Not sent'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
