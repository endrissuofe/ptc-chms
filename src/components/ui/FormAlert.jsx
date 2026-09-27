'use client';

import { signOut } from 'next-auth/react';
import Icon from './Icon';

/**
 * The message under a form after it is sent. Pass an Error (from sendJson) or a
 * { kind: 'success', message } object. An expired sign-in offers "Sign in again".
 */
export default function FormAlert({ error, success, className = '' }) {
  if (error) {
    return (
      <div role="alert" className={`alert alert-danger flex-wrap ${className}`}>
        <Icon name="error_outline" size={19} />
        <span className="min-w-0 flex-1">{error.message || String(error)}</span>
        {error.signedOut && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn btn-sm btn-primary"
          >
            Sign in again
          </button>
        )}
      </div>
    );
  }
  if (success) {
    return (
      <p role="status" className={`alert alert-success ${className}`}>
        <Icon name="check_circle" size={19} filled />
        <span className="min-w-0 flex-1">{success}</span>
      </p>
    );
  }
  return null;
}

/** An error message under one field. Give the field aria-describedby={id}. */
export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="field-error">
      <Icon name="error_outline" size={16} className="mt-px" />
      {children}
    </p>
  );
}
