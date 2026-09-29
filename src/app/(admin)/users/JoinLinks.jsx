'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { CHURCH } from '@/lib/church-profile';
import { ROLE_INFO } from '@/lib/users';

/** One invite link per team, to post in that team's WhatsApp group. */
export default function JoinLinks({ links }) {
  return (
    <section className="of-panel flex min-w-0 flex-col p-5 sm:p-6" aria-labelledby="links-title">
      <div className="flex flex-col gap-1">
        <h2 id="links-title" className="of-h2">
          Team invite links
        </h2>
        <p className="text-meta text-muted">
          Post a team’s link in its WhatsApp group. Everyone who signs up waits for your approval.
        </p>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {links.map((l) => (
          <LinkRow key={l.role} link={l} />
        ))}
      </ul>
    </section>
  );
}

function LinkRow({ link }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState({ kind: 'idle' });
  const role = ROLE_INFO[link.role];
  const message = `Join the ${link.label} on the ${CHURCH.name} app: ${link.url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setState({ kind: 'error', error: { message: 'Couldn’t copy. Press and hold the link.' } });
    }
  }

  async function reset() {
    const ok = await confirm({
      title: `New link for the ${link.label}?`,
      body: 'The old link stops working straight away. Share the new one with the team.',
      confirmLabel: 'Make a new link',
      icon: 'link_off',
    });
    if (!ok) return;
    setState({ kind: 'busy' });
    try {
      await sendJson(`/api/users/join-links/${link.role}`, 'POST');
      setState({ kind: 'ok', message: 'New link ready. The old one no longer works.' });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4 last:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-of-accent-soft text-of-accent-ink">
            <Icon name={role?.icon || 'group'} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{link.label}</p>
            <p className="break-all text-meta text-muted">{link.url}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">
          <button type="button" onClick={copy} className="of-btn-quiet">
            <Icon name={copied ? 'check' : 'content_copy'} size={17} />
            <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="of-btn-quiet"
          >
            <Icon name="chat" size={17} />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={reset}
            aria-disabled={state.kind === 'busy'}
            className="of-link px-2 text-muted hover:text-ink"
            aria-label={`Make a new link for the ${link.label}`}
          >
            <Busy busy={state.kind === 'busy'} icon="autorenew" label="New link" />
          </button>
        </div>
      </div>
      {state.kind === 'error' && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
    </li>
  );
}
