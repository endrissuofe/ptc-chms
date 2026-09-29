'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import CopyButton from '@/components/ui/CopyButton';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { formatServiceTime } from '@/lib/church';
import { MEDIA_KINDS, MEDIA_STATUSES, isYouTubeUrl } from '@/lib/media';
import { PLATFORMS, spellDate } from '@/lib/media-captions';

/** "Sun 4 Oct", the same on the server and in every browser. */
const shortDay = (iso) => spellDate(iso, { weekday: true });

function subtitle(item) {
  const time = item.service && formatServiceTime(item.service.startTime);
  if (item.kind === 'announcement') {
    return `Announcement · ${shortDay(item.serviceDate)}, ${time}`;
  }
  if (item.kind === 'livestream') return `YouTube live · ${time}`;
  if (item.kind === 'celebrations') return item.people.map((p) => p.name).join(', ');
  return 'Quick post';
}

/**
 * One thing on the week's list: its status, ready-made text to copy for each platform, and for
 * services, what the service is about (theme, preacher, Bible text; the YouTube link once live).
 */
export default function MediaItemCard({ item, canEdit, canEditDetails, overdue }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [status, setStatus] = useState(item.status);
  const [state, setState] = useState({ kind: 'idle' });
  const kind = MEDIA_KINDS[item.kind];
  const shown = MEDIA_STATUSES[status];

  async function changeStatus(next) {
    if (next === status || state.kind === 'busy') return;
    const before = status;
    setStatus(next);
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/media/items', 'PATCH', { ref: item.ref, status: next });
      setState({ kind: 'idle' });
      router.refresh();
    } catch (err) {
      setStatus(before);
      setState({ kind: 'error', error: err });
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Remove “${item.title}”?`,
      body: 'It comes off the list for everyone.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    setState({ kind: 'removing' });
    try {
      await sendJson(`/api/media/posts?ref=${encodeURIComponent(item.ref)}`, 'DELETE');
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <article
      className={`of-panel flex flex-col gap-3 p-4 sm:p-5 ${status === 'posted' ? 'opacity-80' : ''}`}
      aria-labelledby={`${item.ref}-title`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={`icon-tile h-10 w-10 shrink-0 ${kind.tone}`}>
          <Icon name={kind.icon} size={20} />
        </span>
        <div className="min-w-[10rem] flex-1">
          <h4 id={`${item.ref}-title`} className="break-words font-brand text-lg font-semibold">
            {item.title}
          </h4>
          <p className="break-words text-meta text-muted">{subtitle(item)}</p>
        </div>
        <span className={`chip ${overdue && status === 'todo' ? 'chip-danger' : shown.chip}`}>
          <Icon name={shown.icon} size={14} />
          {overdue && status === 'todo' ? 'Missed' : shown.label}
        </span>
      </div>

      {canEdit && (
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">Status of {item.title}</legend>
          {Object.entries(MEDIA_STATUSES).map(([key, s]) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => changeStatus(key)}
              className="toggle-chip min-w-[76px] px-3"
            >
              {s.label}
            </button>
          ))}
          {item.postedBy && status === 'posted' && (
            <span className="text-meta text-muted sm:ml-2">by {item.postedBy}</span>
          )}
        </fieldset>
      )}
      {!canEdit && item.postedBy && status === 'posted' && (
        <p className="text-meta text-muted">Posted by {item.postedBy}</p>
      )}
      {state.kind === 'error' && <FormAlert error={state.error} />}

      {item.kind === 'celebrations' ? (
        <Link href="/birthdays" className="of-btn-quiet self-start">
          <Icon name="cake" size={18} />
          Open Birthdays to copy the wishes
        </Link>
      ) : (
        <details className="group border-t border-line pt-3">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-semibold">
            <Icon
              name="expand_more"
              size={22}
              className="text-muted transition-transform group-open:rotate-180"
            />
            {item.kind === 'livestream' ? 'YouTube title, description and link' : 'Text to post'}
          </summary>
          <div className="mt-3 flex flex-col gap-4 motion-safe:animate-fade-in">
            {item.service && canEditDetails && <AboutService item={item} />}
            {Object.entries(item.texts).map(([key, text]) => (
              <PostText key={key} platform={PLATFORMS[key]} text={text} />
            ))}
            {item.kind === 'post' && canEdit && (
              <button
                type="button"
                onClick={remove}
                aria-disabled={state.kind === 'removing'}
                className="btn btn-danger-ghost self-start"
              >
                <Busy
                  busy={state.kind === 'removing'}
                  busyLabel="Removing…"
                  icon="delete"
                  label="Remove this post"
                />
              </button>
            )}
          </div>
        </details>
      )}
    </article>
  );
}

function PostText({ platform, text }) {
  return (
    <div className="flex flex-col gap-2 rounded-tile border border-line bg-surface-2/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-meta font-semibold">
          <Icon name={platform.icon} size={17} className="text-muted" />
          {platform.label}
        </p>
        <CopyButton text={text} label="Copy" className="of-btn-quiet min-h-[40px]" />
      </div>
      <p className="whitespace-pre-wrap break-words text-body">{text}</p>
    </div>
  );
}

const ABOUT = [
  { key: 'theme', label: 'Theme', max: 120, placeholder: 'e.g. Walking in Favour' },
  { key: 'preacher', label: 'Minister', max: 80, placeholder: 'e.g. Pastor Ade Bello' },
  { key: 'bibleText', label: 'Bible text', max: 80, placeholder: 'e.g. Psalm 5:12' },
];

/** Theme, minister and Bible text (and on the live item, the YouTube link) for this service date. */
function AboutService({ item }) {
  const router = useRouter();
  const live = item.kind === 'livestream';
  const fields = live ? [...ABOUT, { key: 'youtubeUrl', label: 'YouTube link', max: 200 }] : ABOUT;
  const [values, setValues] = useState(item.about);
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy';
  const errors = state.kind === 'error' ? (state.error.fields ?? {}) : {};
  const changes = Object.fromEntries(
    fields
      .filter((f) => values[f.key].trim() !== item.about[f.key])
      .map((f) => [f.key, values[f.key].trim()]),
  );
  const dirty = Object.keys(changes).length > 0;
  const link = item.about.youtubeUrl;

  async function save(e) {
    e.preventDefault();
    if (busy || !dirty) return;
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/media/service-days', 'PUT', {
        service: item.service.key,
        date: item.serviceDate,
        ...changes,
      });
      setState({ kind: 'ok' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  const idPrefix = item.ref.replace(/[^a-z0-9]/gi, '-');
  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <p className="text-meta text-muted">
        About this service on {shortDay(item.serviceDate)}. The texts below update when you save.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <label
            key={f.key}
            className={`flex flex-col ${f.key === 'youtubeUrl' ? 'sm:col-span-3' : ''}`}
          >
            <span className="field-label">{f.label}</span>
            <input
              value={values[f.key]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }));
                if (!busy) setState({ kind: 'idle' });
              }}
              maxLength={f.max}
              type={f.key === 'youtubeUrl' ? 'url' : 'text'}
              inputMode={f.key === 'youtubeUrl' ? 'url' : undefined}
              placeholder={f.placeholder ?? 'Paste after the service, e.g. https://youtu.be/…'}
              className="input"
              aria-invalid={errors[f.key] ? true : undefined}
              aria-describedby={errors[f.key] ? `${idPrefix}-${f.key}-error` : undefined}
            />
            <FieldError id={`${idPrefix}-${f.key}-error`}>{errors[f.key]}</FieldError>
          </label>
        ))}
      </div>
      {state.kind === 'error' && !Object.keys(errors).length && <FormAlert error={state.error} />}
      {state.kind === 'ok' && !dirty && <FormAlert success="Saved." />}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!dirty}
          aria-disabled={busy}
          className="of-btn disabled:opacity-50"
        >
          <Busy busy={busy} icon="save" label="Save" />
        </button>
        {live && link && isYouTubeUrl(link) && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="of-btn-quiet">
            <Icon name="open_in_new" size={18} />
            Watch on YouTube
          </a>
        )}
      </div>
    </form>
  );
}
