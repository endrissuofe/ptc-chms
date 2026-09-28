'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import Busy from '@/components/ui/Busy';
import EmptyState from '@/components/ui/EmptyState';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';
import { formatMoment } from '@/lib/format';
import { ALERTS } from '@/lib/users';

/** Each email: its on/off setting and the "other addresses" lists it uses. */
const EMAILS = {
  followUp: {
    setting: 'followUpReport',
    lists: ['followupEmails', 'pastorEmails'],
    tone: 'tone-primary',
  },
  celebrations: { setting: 'celebrationReport', lists: ['celebrationEmails'], tone: 'tone-coral' },
};

export default function AlertsManager({ settings, people, report, email, recent }) {
  return (
    <>
      <EmailCard kind="followUp" settings={settings} people={people} />
      <Preview report={report} email={email} />
      <EmailCard kind="celebrations" settings={settings} people={people} />
      <History recent={recent} />
    </>
  );
}

/** Who gets one email: team logins with a switch each, plus other addresses as chips. */
function EmailCard({ kind, settings, people }) {
  const router = useRouter();
  const info = ALERTS[kind];
  const { setting, lists, tone } = EMAILS[kind];
  const [on, setOn] = useState(settings[setting]);
  const [state, setState] = useState({ kind: 'idle' });
  const eligible = people.filter((p) => info.roles.includes(p.role));
  const receiving = eligible.filter((p) => p.email && p.alerts[kind]).length;
  // Addresses typed in before logins had emails ("copied in" = the old pastors' box) show too.
  const others = lists.flatMap((list) => settings[list].map((address) => ({ address, list })));
  const total = receiving + others.length;

  async function patch(url, body, message) {
    setState({ kind: 'busy' });
    try {
      await sendJson(url, 'PATCH', body);
      setState({ kind: 'ok', message });
      router.refresh();
      return true;
    } catch (err) {
      setState({ kind: 'error', error: err });
      return false;
    }
  }

  async function toggleEmail(value) {
    setOn(value);
    const ok = await patch(
      '/api/alerts',
      { [setting]: value },
      value ? 'Switched on.' : 'Switched off.',
    );
    if (!ok) setOn(!value);
  }

  return (
    <section className="card flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`icon-tile ${tone}`}>
            <Icon name={info.icon} size={22} />
          </span>
          <div>
            <h2 className="card-title">{info.label}</h2>
            <p className="card-sub">
              {total} {total === 1 ? 'person gets' : 'people get'} it
            </p>
          </div>
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
          {on ? 'On' : 'Off'}
          <input
            type="checkbox"
            role="switch"
            checked={on}
            onChange={(e) => toggleEmail(e.target.checked)}
            aria-label={`${info.label}: ${on ? 'on' : 'off'}`}
            className="switch"
          />
        </label>
      </div>

      {eligible.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-tile border border-line">
          {eligible.map((p) => (
            <PersonRow key={p.id} person={p} kind={kind} onChange={patch} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="group" title="Nobody on these teams yet">
          Share the team’s invite link from{' '}
          <Link href="/users" className="font-bold text-primary">
            Logins
          </Link>
          .
        </EmptyState>
      )}

      <OtherAddresses kind={kind} settings={settings} others={others} onChange={patch} />

      {state.kind === 'error' && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
    </section>
  );
}

function PersonRow({ person: p, kind, onChange }) {
  const [on, setOn] = useState(p.alerts[kind]);
  const copied = kind === 'followUp' && p.role !== 'followup';

  async function toggle(value) {
    setOn(value);
    const ok = await onChange(
      `/api/users/${p.id}`,
      { alerts: { [kind]: value } },
      value ? `${p.name} will get it.` : `${p.name} won’t get it any more.`,
    );
    if (!ok) setOn(!value);
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <Avatar name={p.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="break-words font-bold">{p.name}</p>
        <p className="break-words text-meta text-muted">
          {p.roleLabel} · {p.email || 'No email yet'}
          {p.email && on && copied && ' · copied in'}
        </p>
      </div>
      {p.email ? (
        <input
          type="checkbox"
          role="switch"
          checked={on}
          onChange={(e) => toggle(e.target.checked)}
          aria-label={`${p.name} gets this email`}
          className="switch"
        />
      ) : (
        <span className="chip chip-warning">Needs an email</span>
      )}
    </li>
  );
}

/** Addresses without a login (e.g. a shared church inbox). Saved at once; shown as chips. */
function OtherAddresses({ kind, settings, others, onChange }) {
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const addTo = kind === 'followUp' ? 'followupEmails' : 'celebrationEmails';
  const inputId = `${kind}-other`;

  async function save(list, next, message) {
    setBusy(true);
    const ok = await onChange('/api/alerts', { [list]: next }, message);
    setBusy(false);
    return ok;
  }

  async function add(e) {
    e.preventDefault();
    const value = address.trim().toLowerCase();
    if (!value || busy) return;
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError('Check this email address');
      return;
    }
    setError(null);
    if (await save(addTo, [...settings[addTo], value], `Added ${value}.`)) setAddress('');
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="field-label">
        Other addresses
      </label>
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {others.map(({ address: a, list }) => (
            <li key={`${list}-${a}`} className="chip max-w-full py-0 pr-0">
              <span className="break-all">{a}</span>
              {list === 'pastorEmails' && <span className="text-muted">· copied in</span>}
              <button
                type="button"
                onClick={() =>
                  save(
                    list,
                    settings[list].filter((x) => x !== a),
                    `Removed ${a}.`,
                  )
                }
                aria-label={`Remove ${a}`}
                className="icon-btn"
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          type="email"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setError(null);
          }}
          placeholder="e.g. media@gmail.com"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="input min-w-[12rem] flex-1 sm:max-w-sm"
        />
        <button type="submit" aria-disabled={busy} className="btn btn-soft">
          <Busy busy={busy} icon="add" label="Add" />
        </button>
      </div>
      <FieldError id={`${inputId}-error`}>{error}</FieldError>
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

const KIND_LABEL = {
  test: 'Test email',
  signup: 'New sign-up',
  approved: 'Sign-up approved',
};

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
                    <span className="font-semibold">{KIND_LABEL[e.kind] ?? e.subject}</span>
                  </td>
                  <td className="text-right tabular-nums">{e.to}</td>
                  <td className="pr-5">
                    <span
                      className={`chip ${e.status === 'sent' ? 'chip-success' : 'chip-danger'}`}
                      title={e.error ?? undefined}
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
