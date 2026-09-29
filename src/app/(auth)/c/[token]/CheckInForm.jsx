'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';
import { RATINGS } from '@/lib/checkin';

const ORDER = [5, 4, 3, 2, 1];

export default function CheckInForm({ token, answered }) {
  const [rating, setRating] = useState(null);
  const [wantsCall, setWantsCall] = useState(false);
  const [comment, setComment] = useState('');
  const [state, setState] = useState({ kind: answered ? 'done' : 'idle' });
  const busy = state.kind === 'busy';
  const fields = state.kind === 'error' ? (state.error.fields ?? {}) : {};

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!rating) {
      setState({ kind: 'error', error: { fields: { rating: 'Choose an answer' } } });
      document.getElementById('rating-5')?.focus();
      return;
    }
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/checkin', 'POST', {
        token,
        rating,
        wantsCall,
        comment: comment.trim() || undefined,
      });
      setState({ kind: 'done', wantsCall });
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  if (state.kind === 'done') {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="icon-tile tone-success">
          <Icon name="favorite" size={22} />
        </span>
        <p className="of-h2">Thank you!</p>
        <p>
          {state.wantsCall
            ? 'Someone from the church will call you soon.'
            : 'Your answer helps us welcome people better. We hope to see you on Sunday!'}
        </p>
        {answered && !state.wantsCall && (
          <button
            type="button"
            onClick={() => setState({ kind: 'idle' })}
            className="tap-link self-start text-of-accent-ink"
          >
            Change my answer
          </button>
        )}
      </div>
    );
  }

  const banner = state.kind === 'error' && !Object.keys(fields).length ? state.error : null;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={fields.rating ? 'rating-error' : undefined}
      >
        <legend className="field-label">How has your first month with us been?</legend>
        <div className="flex flex-col gap-2">
          {ORDER.map((n) => (
            <label
              key={n}
              className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-tile border-[1.5px] px-4 font-bold transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-of-accent ${
                rating === n
                  ? 'border-of-accent bg-of-accent-soft text-of-accent-ink'
                  : 'border-field/50 hover:bg-surface-2'
              }`}
            >
              <input
                id={`rating-${n}`}
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n);
                  if (state.kind === 'error') setState({ kind: 'idle' });
                }}
                className="sr-only"
              />
              <span className="flex gap-0.5 text-coral" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon key={i} name="star" size={18} filled={i < n} />
                ))}
              </span>
              {RATINGS[n].label}
            </label>
          ))}
        </div>
        <FieldError id="rating-error">{fields.rating}</FieldError>
      </fieldset>

      <label className="check-row">
        <input
          type="checkbox"
          checked={wantsCall}
          onChange={(e) => setWantsCall(e.target.checked)}
          className="checkbox"
        />
        <span className="font-bold">I’d like someone from the church to call me</span>
      </label>

      <label className="flex flex-col">
        <span className="field-label">
          Anything you’d like to tell us? <span className="font-semibold text-muted">Optional</span>
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          className="input"
        />
      </label>

      {banner && <FormAlert error={banner} />}
      <button type="submit" aria-disabled={busy} className="of-btn min-h-[52px] text-base">
        <Busy busy={busy} busyLabel="Sending…" icon="send" label="Send" />
      </button>
    </form>
  );
}
