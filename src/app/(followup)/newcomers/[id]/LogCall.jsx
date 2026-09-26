'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { CHANNELS, OUTCOMES } from '@/lib/followup';

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
  const [outcome, setOutcome] = useState(null);
  const [channel, setChannel] = useState('call');
  const [note, setNote] = useState('');
  const [callerName, setCallerName] = useState('');
  const [state, setState] = useState({ kind: 'idle' });

  useEffect(() => setCallerName(readName()), []);

  async function save(e) {
    e.preventDefault();
    if (!outcome) {
      setState({ kind: 'error', message: 'Choose what happened on the call.' });
      return;
    }
    setState({ kind: 'busy' });
    try {
      const res = await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId,
          outcome,
          channel,
          note: note.trim() || undefined,
          callerName: callerName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Could not save');
      saveName(callerName.trim());
      setOutcome(null);
      setNote('');
      setState({ kind: 'ok' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  return (
    <form id="log" onSubmit={save} className="card flex scroll-mt-24 flex-col gap-4">
      <h2 className="card-title flex items-center gap-2">
        <Icon name="edit_note" size={22} className="text-primary" />
        Log a call
      </h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label">What happened?</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(OUTCOMES).map(([key, o]) => (
            <button
              key={key}
              type="button"
              aria-pressed={outcome === key}
              onClick={() => {
                setOutcome(key);
                setState({ kind: 'idle' });
              }}
              className={`btn btn-sm ${outcome === key ? 'btn-primary' : 'btn-ghost'}`}
            >
              <Icon name={o.icon} size={16} />
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="field-label">How</span>
        <div role="radiogroup" aria-label="How" className="seg-tabs self-start">
          {Object.entries(CHANNELS).map(([key, c]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={channel === key}
              aria-selected={channel === key}
              onClick={() => setChannel(key)}
              className="seg-tab"
            >
              <Icon name={c.icon} size={16} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

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
          placeholder="e.g. Sis. Deborah"
          autoComplete="name"
          className="input"
        />
      </label>

      {state.kind === 'error' && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="alert alert-success">
          <Icon name="check_circle" size={19} filled />
          Saved. It’s in the history below.
        </p>
      )}

      <button type="submit" disabled={state.kind === 'busy'} className="btn btn-coral btn-lg">
        <Icon name="save" size={19} />
        {state.kind === 'busy' ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
