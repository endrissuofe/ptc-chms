'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';

/** Copies a ready-made post for the church's WhatsApp, Instagram or Facebook. */
export default function CopyButton({ text }) {
  const [state, setState] = useState('idle'); // idle | copied | failed

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  }

  return (
    <button type="button" onClick={copy} className="btn btn-ghost btn-sm" title={text}>
      <Icon name={state === 'copied' ? 'check' : 'content_copy'} size={16} />
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy' : 'Copy for socials'}
      </span>
    </button>
  );
}
