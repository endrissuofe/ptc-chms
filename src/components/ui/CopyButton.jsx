'use client';

import { useState } from 'react';
import Icon from './Icon';

/** Copies ready-made text, e.g. a post for the church's WhatsApp, Instagram or Facebook. */
export default function CopyButton({
  text,
  label = 'Copy for socials',
  className = 'of-btn-quiet',
}) {
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
    <button type="button" onClick={copy} className={className} title={text}>
      <Icon name={state === 'copied' ? 'check' : 'content_copy'} size={18} />
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy' : label}
      </span>
    </button>
  );
}
