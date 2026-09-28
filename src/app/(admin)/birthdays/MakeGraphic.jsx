'use client';

import { useEffect, useRef, useState } from 'react';
import { Bebas_Neue, Quicksand } from 'next/font/google';
import Icon from '@/components/ui/Icon';
import FormAlert from '@/components/ui/FormAlert';

// The design's lettering: Bebas Neue for BIRTHDAY, Quicksand for the rest.
const display = Bebas_Neue({ weight: '400', subsets: ['latin'], display: 'swap' });
const text = Quicksand({ weight: ['500', '600'], subsets: ['latin'], display: 'swap' });

const dayMonth = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
});
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * "Make graphic": the media team picks the celebrant's photo on their phone; the app cuts the
 * person out, lays out the church's design, and offers Download / Share. Nothing is uploaded.
 */
export default function MakeGraphic({ kind, name, date }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ kind: 'idle' });
  const [file, setFile] = useState(null);
  const canvas = useRef(null);
  const input = useRef(null);
  const busy = state.kind === 'busy';
  const label = kind === 'anniversary' ? 'anniversary' : 'birthday';
  const fileName = `happy-${label}-${slug(name)}.png`;

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function render(photoFile, { cut = true } = {}) {
    setState({ kind: 'busy', message: 'Opening the photo…' });
    try {
      const [g, check] = await Promise.all([
        import('@/lib/graphics/celebration'),
        import('@/lib/graphics/photo-check'),
      ]);
      let shot;
      if (cut) {
        try {
          shot = await g.cutOut(photoFile, (message) => setState({ kind: 'busy', message }));
        } catch {
          setState({
            kind: 'busy',
            message: 'Couldn’t cut out the background, so using the photo as it is…',
          });
          shot = await g.plainPhoto(photoFile);
          cut = false;
        }
      } else {
        shot = await g.plainPhoto(photoFile);
      }
      setState({ kind: 'busy', message: 'Finding their face…' });
      const figure = cut ? g.subjectBounds(shot.person) : null;
      const { face, warnings } = await check.checkPhoto(shot.photo, figure);
      setState({ kind: 'busy', message: 'Laying out the design…' });
      await g.drawCelebration(canvas.current, {
        kind,
        person: shot.person,
        face,
        name,
        date: dayMonth.format(new Date(date)),
        fonts: { display: display.style.fontFamily, text: text.style.fontFamily },
      });
      setState({ kind: 'done', cut, warnings });
    } catch (err) {
      setState({ kind: 'error', error: { message: err.message || 'Something went wrong' } });
    }
  }

  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setState({ kind: 'error', error: { message: 'Choose a photo (JPG or PNG)' } });
      return;
    }
    setFile(f);
    render(f);
  }

  const toBlob = () => new Promise((r) => canvas.current.toBlob(r, 'image/png'));

  async function download() {
    const url = URL.createObjectURL(await toBlob());
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    const shareFile = new File([await toBlob()], fileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [shareFile], title: `Happy ${label}, ${name}!` });
    } catch (err) {
      if (err?.name !== 'AbortError') download();
    }
  }

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">
        <Icon name="photo_camera" size={16} />
        Make graphic
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-tile border border-line bg-surface p-3 motion-safe:animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">Graphic for the church’s socials</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="icon-btn"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <label className="btn btn-soft btn-sm self-start">
        <Icon name="photo_camera" size={16} />
        {file ? 'Choose a different photo' : `Choose ${name.split(' ')[0]}’s photo`}
        <input
          ref={input}
          type="file"
          accept="image/*"
          onChange={pick}
          disabled={busy}
          className="sr-only"
        />
      </label>

      {busy && (
        <p role="status" className="flex items-center gap-2 text-meta text-muted">
          <Icon name="sync" size={16} className="motion-safe:animate-spin" />
          {state.message}
        </p>
      )}
      {state.kind === 'error' && <FormAlert error={state.error} />}

      <canvas
        ref={canvas}
        width={1080}
        height={1350}
        aria-label={`Happy ${label} graphic for ${name}`}
        className={`w-full max-w-[20rem] rounded-tile border border-line ${
          state.kind === 'done' ? '' : 'hidden'
        }`}
      />

      {state.kind === 'done' && state.warnings.length > 0 && (
        <div role="status" className="alert alert-warning flex-col items-start gap-1">
          <p className="flex items-center gap-1.5 font-bold">
            <Icon name="info" size={18} />
            Check before posting
          </p>
          <ul className="list-disc pl-5">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {state.kind === 'done' && (
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <button type="button" onClick={share} className="btn btn-primary btn-sm">
              <Icon name="share" size={16} />
              Share
            </button>
          )}
          <button
            type="button"
            onClick={download}
            className={`btn btn-sm ${canShare ? 'btn-soft' : 'btn-primary'}`}
          >
            <Icon name="download" size={16} />
            Download
          </button>
          {state.cut ? (
            <button
              type="button"
              onClick={() => render(file, { cut: false })}
              className="btn btn-ghost btn-sm"
            >
              Use the photo without cutting it out
            </button>
          ) : (
            <button type="button" onClick={() => render(file)} className="btn btn-ghost btn-sm">
              Try cutting it out again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
