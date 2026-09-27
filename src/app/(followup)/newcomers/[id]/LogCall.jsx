'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { CHANNELS, OUTCOMES } from '@/lib/followup';
import { sendJson } from '@/lib/client-api';

// The follow-up team shares one login, so each phone remembers who is calling.
const NAME_KEY = 'ptc.callerName';
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};
const saveName = (name) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Private browsing: the name just isn't remembered.
  }
};

export default function LogCall({ personId, firstName }) {
  const router = useRouter();
  const heading = useRef(null);
  const [outcome, setOutcome] = useState(null);
  const [channel, setChannel] = useState('call');
  const [note, setNote] = useState('');
  const [callerName, setCallerName] = useState('');
  const [missingOutcome, setMissingOutcome] = useState(false);
  const [state, setState] = useState({ kind: 'idle' });

  useEffect(() => setCallerName(readName()), []);
  const busy = state.kind === 'busy';

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (!outcome) {
      setMissingOutcome(true);
      document.getElementById('outcome-reached')?.focus();
      return;
    }
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/follow-ups', 'POST', {
        personId,
        outcome,
        channel,
        note: note.trim() || undefined,
        callerName: callerName.trim() || undefined,
      });
      saveName(callerName.trim());
      setState({ kind: 'ok', message: `${OUTCOMES[outcome].label} — saved in the history below.` });
      setOutcome(null);
      setNote('');
      heading.current?.focus();
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <form id="log" onSubmit={save} className="card flex scroll-mt-24 flex-col gap-5">
      <h2 ref={heading} tabIndex={-1} className="card-title flex items-center gap-2 outline-none">
        <Icon name="edit_note" size={22} className="text-primary" />
        Log a call
      </h2>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={missingOutcome ? 'outcome-error' : undefined}
      >
        <legend className="field-label">What happened?</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(OUTCOMES).map(([key, o]) => (
            <button
              key={key}
              id={`outcome-${key}`}
              type="button"
              aria-pressed={outcome === key}
              onClick={() => {
                setOutcome(key);
                setMissingOutcome(false);
                setState({ kind: 'idle' });
              }}
              className="toggle-chip"
            >
              <Icon name={o.icon} size={17} />
              {o.label}
            </button>
          ))}
        </div>
        {missingOutcome && (
          <FieldError id="outcome-error">Choose what happened on the call.</FieldError>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label">How</legend>
        <div className="seg-tabs self-start">
          {Object.entries(CHANNELS).map(([key, c]) => (
            <label
              key={key}
              className="seg-tab cursor-pointer has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-primary"
            >
              <input
                type="radio"
                name="channel"
                value={key}
                checked={channel === key}
                onChange={() => setChannel(key)}
                className="sr-only"
              />
              <Icon name={c.icon} size={16} />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col">
        <span className="field-label">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={`e.g. Spoke with ${firstName}, will come on Sunday with the family`}
          className="input"
        />
      </label>

      <label className="flex flex-col">
        <span className="field-label">Your name</span>
        <input
          value={callerName}
          onChange={(e) => setCallerName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Bro. Tunde"
          autoComplete="name"
          className="input"
        />
        <span className="field-hint">Remembered on this phone.</span>
      </label>

      {state.kind === 'error' && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}

      <button type="submit" aria-disabled={busy} className="btn btn-primary btn-lg">
        <Busy busy={busy} icon="save" label="Save call" size={19} />
      </button>
    </form>
  );
}
