'use client';

import { forwardRef, useState } from 'react';
import Icon from './Icon';

/**
 * Password field with a Show/Hide button (44px tap area). Other props go to the <input>.
 * `tone="night"` is the Onefold sign-in's dark glass field.
 */
const PasswordInput = forwardRef(function PasswordInput(
  { withIcon = false, reveal = false, tone = 'default', className = '', ...props },
  ref,
) {
  const [show, setShow] = useState(false);
  const visible = reveal || show;
  const night = tone === 'night';
  return (
    <span className="relative block">
      {withIcon && (
        <Icon
          name="lock"
          size={20}
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${night ? 'text-of-mist/55' : 'text-muted'}`}
        />
      )}
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`${night ? 'of-field' : 'input'} pr-20 ${withIcon ? 'pl-11' : ''} ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className={`absolute right-1 top-1/2 inline-flex min-h-[44px] -translate-y-1/2 items-center rounded-full px-3.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-[3px] ${
          night
            ? 'text-of-pine-bright hover:bg-white/10 focus-visible:ring-of-pine-bright'
            : 'text-primary hover:bg-primary-soft focus-visible:ring-primary'
        }`}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </span>
  );
});

export default PasswordInput;
