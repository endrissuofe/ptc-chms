/**
 * Design tokens. Values live as CSS variables in src/app/globals.css (light and dark themes);
 * the look follows the "Homeroom" template: indigo + coral on warm paper, Nunito headings,
 * Figtree body, very rounded cards. Change the brand by editing the variables, not these names.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: v('bg'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') },
        ink: { DEFAULT: v('ink'), 2: v('ink-2') },
        muted: v('muted'),
        line: { DEFAULT: v('line'), 2: v('line-2') },
        primary: {
          DEFAULT: v('primary'),
          strong: v('primary-strong'),
          dark: v('primary-strong'),
          soft: v('primary-soft'),
          ink: v('primary-ink'),
        },
        'on-primary': v('on-primary'),
        coral: {
          DEFAULT: v('coral'),
          strong: v('coral-strong'),
          soft: v('coral-soft'),
          ink: v('coral-ink'),
        },
        'on-coral': v('on-coral'),
        success: { DEFAULT: v('success'), soft: v('success-soft') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
        danger: { DEFAULT: v('danger'), subtle: v('danger-soft'), soft: v('danger-soft') },
        teal: { DEFAULT: v('teal'), soft: v('teal-soft') },
        violet: { DEFAULT: v('violet'), soft: v('violet-soft') },
        // Older names used across the screens, mapped onto the palette above.
        secondary: { DEFAULT: v('teal'), dark: v('teal') },
        tertiary: v('violet'),
        stage: {
          'first-bg': v('coral-soft'),
          'first-text': v('coral-ink'),
          'second-bg': v('primary-soft'),
          'second-text': v('primary-ink'),
          'regular-bg': v('teal-soft'),
          'regular-text': v('teal'),
          'class-bg': v('violet-soft'),
          'class-text': v('violet'),
          'member-bg': v('success'),
          'member-text': v('on-primary'),
        },
      },
      fontFamily: {
        display: ['Nunito', 'Trebuchet MS', 'system-ui', 'sans-serif'],
        serif: ['Nunito', 'Trebuchet MS', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '22px',
        tile: '16px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(30,27,58,.04), 0 4px 14px rgba(30,27,58,.05)',
        lift: '0 2px 6px rgba(30,27,58,.05), 0 14px 34px rgba(30,27,58,.08)',
        pop: '0 24px 60px rgba(30,27,58,.18)',
        'primary-glow': '0 6px 16px -6px rgb(var(--primary) / .55)',
        'coral-glow': '0 6px 16px -6px rgb(var(--coral-strong) / .6)',
      },
    },
  },
  plugins: [],
};

export default config;
