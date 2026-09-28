'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import EmptyState from '@/components/ui/EmptyState';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';
import { formatMoment } from '@/lib/format';
import CelebrationsCard from './CelebrationsCard';

const toList = (text) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

export default function AlertsManager({ settings, report, email, recent }) {
  return (
    <>
      <Recipients settings={settings} />
      <Preview report={report} email={email} />
      <CelebrationsCard settings={settings} />
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

function Preview({ report, email }) {
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
    </section>
  );
}

function History({ recent }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">Recent emails</h2>
      {recent.length === 0 ? (
        <EmptyState card icon="mail" title="No emails sent yet" />
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
