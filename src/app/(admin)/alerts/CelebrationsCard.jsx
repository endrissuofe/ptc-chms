'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';

const toList = (text) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

/** Who gets the 7 AM birthdays and anniversaries email, plus "send today's now". */
export default function CelebrationsCard({ settings }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [list, setList] = useState(settings.celebrationEmails.join('\n'));
  const [on, setOn] = useState(settings.celebrationReport);
  const [state, setState] = useState({ kind: 'idle' });
  const [send, setSend] = useState({ kind: 'idle' });
  const emails = toList(list);
  const busy = state.kind === 'busy';

  const issues =
    state.kind === 'error' && Array.isArray(state.error.details) ? state.error.details : [];
  const issue = issues.find((i) => i.path?.[0] === 'celebrationEmails');
  const bad = issue ? emails[issue.path?.[1]] : null;
  const listError = issue ? (bad ? `“${bad}” isn’t a valid email address` : issue.message) : null;

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      const saved = await sendJson('/api/alerts', 'PATCH', {
        celebrationEmails: emails,
        celebrationReport: on,
      });
      setList(saved.celebrationEmails.join('\n'));
      setState({ kind: 'ok', message: 'Saved.' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  async function sendNow() {
    if (send.kind === 'busy') return;
    const ok = await confirm({
      title: 'Send today’s celebrations email now?',
      body: 'It goes to the addresses in this box. Tomorrow’s 7 AM email still goes out as usual.',
      confirmLabel: 'Send now',
      icon: 'send',
    });
    if (!ok) return;
    setSend({ kind: 'busy' });
    try {
      const r = await sendJson('/api/alerts/celebrations', 'POST');
      setSend(
        r.sent
          ? { kind: 'ok', message: `Sent to ${r.to} ${r.to === 1 ? 'person' : 'people'}.` }
          : { kind: 'error', error: { message: r.error || `Not sent: ${r.skipped}.` } },
      );
      router.refresh();
    } catch (err) {
      setSend({ kind: 'error', error: err });
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="icon-tile tone-coral">
            <Icon name="cake" size={22} />
          </span>
          <div>
            <h2 className="card-title">Birthdays and anniversaries email</h2>
          </div>
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
          {on ? 'On' : 'Off'}
          <input
            type="checkbox"
            role="switch"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            aria-label={`Birthdays and anniversaries email: ${on ? 'on' : 'off'}`}
            className="switch"
          />
        </label>
      </div>
      <label className="flex flex-col md:max-w-[50%]">
        <span className="field-label">
          Admin and media team
          <span className="font-semibold text-muted">{emails.length}</span>
        </span>
        <textarea
          rows={4}
          value={list}
          onChange={(e) => setList(e.target.value)}
          placeholder="e.g. media@gmail.com"
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={listError ? true : undefined}
          aria-describedby={listError ? 'celebrations-error' : undefined}
          className="input resize-y"
        />
        <FieldError id="celebrations-error">{listError}</FieldError>
      </label>
      {state.kind === 'error' && !listError && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
      {send.kind === 'error' && <FormAlert error={send.error} />}
      {send.kind === 'ok' && <FormAlert success={send.message} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" aria-disabled={busy} className="btn btn-primary">
          <Busy busy={busy} icon="save" label="Save" />
        </button>
        <button
          type="button"
          onClick={sendNow}
          disabled={!settings.celebrationEmails.length}
          aria-disabled={send.kind === 'busy'}
          className="btn btn-soft"
        >
          <Busy
            busy={send.kind === 'busy'}
            busyLabel="Sending…"
            icon="send"
            label="Send today’s now"
          />
        </button>
      </div>
    </form>
  );
}
