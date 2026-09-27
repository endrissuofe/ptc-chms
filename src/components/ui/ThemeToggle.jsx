'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

/** Runs in <head> before first paint: applies a saved choice, otherwise the device setting wins. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The current theme and a function to flip it. The choice is remembered on this device. */
export function useTheme() {
  const [theme, setTheme] = useState(null);
  useEffect(() => setTheme(currentTheme()), []);
  function toggle() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private browsing: the choice just isn't remembered.
    }
    setTheme(next);
  }
  return [theme, toggle];
}

/** Light/dark switch in the top bar (desktop; phones have it in the account menu). */
export default function ThemeToggle({ className = '' }) {
  const [theme, toggle] = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className={`icon-btn ${className}`}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      <Icon name={dark ? 'light_mode' : 'dark_mode'} size={21} />
    </button>
  );
}
