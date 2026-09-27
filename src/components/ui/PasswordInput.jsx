'use client';

import { forwardRef, useState } from 'react';
import Icon from './Icon';

/** Password field with a Show/Hide button (44px tap area). Other props go to the <input>. */
const PasswordInput = forwardRef(function PasswordInput(
  { withIcon = false, reveal = false, className = '', ...props },
  ref,
) {
  const [show, setShow] = useState(false);
  const visible = reveal || show;
  return (
    <span className="relative block">
      {withIcon && (
        <Icon
          name="lock"
          size={20}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
      )}
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`input pr-20 ${withIcon ? 'pl-11' : ''} ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 inline-flex min-h-[44px] -translate-y-1/2 items-center rounded-full px-3.5 text-sm font-bold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </span>
  );
});

export default PasswordInput;
