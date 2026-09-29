'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Busy from '@/components/ui/Busy';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';

export default function QuickPostForm({ initialDate }) {
  const router = useRouter();
  const [values, setValues] = useState({ date: initialDate, title: '', details: '' });
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy';
  const errors = state.kind === 'error' ? (state.error.fields ?? {}) : {};
  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (!busy) setState({ kind: 'idle' });
  };
  const invalid = (key) =>
    errors[key] ? { 'aria-invalid': true, 'aria-describedby': `post-${key}-error` } : {};

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/media/posts', 'POST', {
        date: values.date,
        title: values.title.trim(),
        details: values.details.trim(),
      });
      router.push('/media');
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <form onSubmit={submit} className="of-panel flex flex-col gap-4 p-5 sm:p-6">
      <label className="flex flex-col sm:max-w-[14rem]">
        <span className="field-label">Day to post</span>
        <input
          type="date"
          value={values.date}
          onChange={set('date')}
          required
          className="input"
          {...invalid('date')}
        />
        <FieldError id="post-date-error">{errors.date}</FieldError>
      </label>
      <label className="flex flex-col">
        <span className="field-label">Title</span>
        <input
          value={values.title}
          onChange={set('title')}
          maxLength={80}
          required
          placeholder="e.g. Choir rehearsal moved to Friday"
          className="input"
          {...invalid('title')}
        />
        <FieldError id="post-title-error">{errors.title}</FieldError>
      </label>
      <label className="flex flex-col">
        <span className="field-label">What the post says</span>
        <textarea
          value={values.details}
          onChange={set('details')}
          rows={5}
          maxLength={1500}
          required
          placeholder="e.g. This week’s rehearsal is on Friday at 5 PM in the main hall."
          className="input"
          {...invalid('details')}
        />
        <FieldError id="post-details-error">{errors.details}</FieldError>
        <span className="field-hint">
          The church’s hashtags and WhatsApp sign-off are added from the brand kit.
        </span>
      </label>
      {state.kind === 'error' && !Object.keys(errors).length && <FormAlert error={state.error} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" aria-disabled={busy} className="of-btn">
          <Busy busy={busy} busyLabel="Adding…" icon="add" label="Add to the list" />
        </button>
        <Link href="/media" className="of-btn-quiet bg-transparent">
          Cancel
        </Link>
      </div>
    </form>
  );
}
