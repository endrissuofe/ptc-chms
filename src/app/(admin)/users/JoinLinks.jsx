'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { ROLE_INFO } from '@/lib/users';

/** One invite link per team, to post in that team's WhatsApp group. */
export default function JoinLinks({ links }) {
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="icon-tile tone-teal">
          <Icon name="link" size={22} />
        </span>
        <div>
          <h2 className="card-title">Team invite links</h2>
          <p className="card-sub">People who sign up wait here until you approve them.</p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-tile border border-line">
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
  const message = `Join the ${link.label} on the Ptchapel app: ${link.url}`;

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
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon name={role?.icon || 'group'} size={20} className="text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{link.label}</p>
          <p className="break-all text-meta text-muted">{link.url}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={copy} className="btn btn-soft btn-sm">
            <Icon name={copied ? 'check' : 'content_copy'} size={16} />
            <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-soft btn-sm"
          >
            <Icon name="chat" size={16} />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={reset}
            aria-disabled={state.kind === 'busy'}
            className="btn btn-ghost btn-sm"
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
