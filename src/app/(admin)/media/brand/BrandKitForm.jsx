'use client';

import { useState } from 'react';
import Busy from '@/components/ui/Busy';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';

const FIELDS = [
  {
    key: 'address',
    label: 'Where the church meets',
    placeholder: 'e.g. 12 Palm Avenue, Ikeja, Lagos',
    max: 160,
  },
  {
    key: 'facebook',
    label: 'Facebook page link',
    placeholder: 'https://facebook.com/…',
    max: 200,
    type: 'url',
  },
  { key: 'instagram', label: 'Instagram handle', placeholder: 'e.g. @yourchurch', max: 40 },
  {
    key: 'youtube',
    label: 'YouTube channel link',
    placeholder: 'https://youtube.com/@…',
    max: 200,
    type: 'url',
    hint: 'Shown in announcements for services streamed live.',
  },
  {
    key: 'hashtags',
    label: 'Hashtags',
    placeholder: 'e.g. #YourChurch #SundayService',
    max: 400,
    hint: 'Added to the end of Facebook, Instagram and YouTube posts.',
  },
  {
    key: 'signoff',
    label: 'WhatsApp sign-off',
    max: 120,
    hint: 'The last line of WhatsApp messages.',
  },
];

export default function BrandKitForm({ initial, readOnly, churchName }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy';
  const errors = state.kind === 'error' ? (state.error.fields ?? {}) : {};
  const changes = Object.fromEntries(
    FIELDS.filter((f) => values[f.key].trim() !== saved[f.key]).map((f) => [
      f.key,
      values[f.key].trim(),
    ]),
  );
  const dirty = Object.keys(changes).length > 0;

  async function save(e) {
    e.preventDefault();
    if (busy || !dirty) return;
    setState({ kind: 'busy' });
    try {
      const brand = await sendJson('/api/media/brand', 'PATCH', changes);
      const next = {
        ...brand,
        instagram: brand.instagram ? `@${brand.instagram}` : '',
        hashtags: brand.hashtags.map((t) => `#${t}`).join(' '),
      };
      setSaved(next);
      setValues(next);
      setState({ kind: 'ok' });
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <form onSubmit={save} className="of-panel flex flex-col gap-4 p-5 sm:p-6">
      {readOnly && (
        <p className="text-meta text-muted">Only the media team and admins can change these.</p>
      )}
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col">
          <span className="field-label">{f.label}</span>
          <input
            value={values[f.key]}
            onChange={(e) => {
              setValues((v) => ({ ...v, [f.key]: e.target.value }));
              if (!busy) setState({ kind: 'idle' });
            }}
            readOnly={readOnly}
            type={f.type ?? 'text'}
            maxLength={f.max}
            placeholder={
              f.key === 'signoff' ? `e.g. — ${churchName}. God bless you!` : f.placeholder
            }
            className="input"
            aria-invalid={errors[f.key] ? true : undefined}
            aria-describedby={errors[f.key] ? `brand-${f.key}-error` : undefined}
          />
          <FieldError id={`brand-${f.key}-error`}>{errors[f.key]}</FieldError>
          {f.hint && <span className="field-hint">{f.hint}</span>}
        </label>
      ))}
      {state.kind === 'error' && !Object.keys(errors).length && <FormAlert error={state.error} />}
      {state.kind === 'ok' && !dirty && <FormAlert success="Brand kit saved." />}
      {!readOnly && (
        <button
          type="submit"
          disabled={!dirty}
          aria-disabled={busy}
          className="of-btn self-start disabled:opacity-50"
        >
          <Busy busy={busy} icon="save" label="Save" />
        </button>
      )}
    </form>
  );
}
