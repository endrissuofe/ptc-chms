/**
 * Design tokens. Values live as CSS variables in src/app/globals.css (light and dark themes);
 * the look is Onefold: pine + dawn on cool stone, Familjen Grotesk headings, Instrument Sans
 * text (the token names are older, e.g. "primary" is pine and "coral" is dawn). docs/DESIGN.md describes how to use them.
 * Change the brand by editing the variables, not these names.
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
        // Form field edges: darker than card lines so empty fields stay visible (3:1).
        field: v('field-line'),
        primary: {
          DEFAULT: v('primary'),
          strong: v('primary-strong'),
          soft: v('primary-soft'),
          ink: v('primary-ink'),
          // Solid button fill (indigo with white text in both themes).
          fill: v('primary-fill'),
          'fill-hover': v('primary-fill-hover'),
          'fill-active': v('primary-fill-active'),
        },
        'on-primary': v('on-primary'),
        'on-primary-fill': v('on-primary-fill'),
        coral: {
          DEFAULT: v('coral'),
          strong: v('coral-strong'),
          soft: v('coral-soft'),
          ink: v('coral-ink'),
        },
        'on-coral': v('on-coral'),
        success: { DEFAULT: v('success'), soft: v('success-soft') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
        teal: { DEFAULT: v('teal'), soft: v('teal-soft') },
        violet: { DEFAULT: v('violet'), soft: v('violet-soft') },
        // Onefold, the product brand (sign-in first; the rest of the app moves over later).
        of: {
          night: v('of-night'),
          'night-2': v('of-night-2'),
          pine: v('of-pine'),
          'pine-bright': v('of-pine-bright'),
          dawn: v('of-dawn'),
          mist: v('of-mist'),
          accent: v('of-accent'),
          'accent-soft': v('of-accent-soft'),
          'accent-ink': v('of-accent-ink'),
          'on-accent': v('of-on-accent'),
          sun: v('of-sun'),
          'sun-soft': v('of-sun-soft'),
        },
      },
      fontFamily: {
        display: ['Familjen Grotesk', 'Instrument Sans', 'system-ui', 'sans-serif'],
        sans: ['Instrument Sans', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        brand: ['Familjen Grotesk', 'Instrument Sans', 'system-ui', 'sans-serif'],
        ui: ['Instrument Sans', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      /*
       * The type scale (rem, so text grows when someone enlarges it). Use only these:
       * 2xs 11 · xs 12 · meta 13 · sm 14 · body 15 · base 16 · lg 18 · xl 20 · 2xl 24
       * · stat 36 (figures) · stat-lg 44 (the big count) · page-title / hero-title (fluid).
       */
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        meta: ['0.8125rem', { lineHeight: '1.25rem' }],
        body: ['0.9375rem', { lineHeight: '1.6' }],
        stat: ['2.25rem', { lineHeight: '1' }],
        'stat-lg': ['2.75rem', { lineHeight: '1' }],
        'page-title': ['clamp(1.75rem, 1.35rem + 1.4vw, 2.25rem)', { lineHeight: '1.15' }],
        'hero-title': ['clamp(1.85rem, 1.3rem + 2vw, 2.6rem)', { lineHeight: '1.1' }],
      },
      borderRadius: {
        card: '22px',
        tile: '16px',
        control: '12px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(10,26,22,.04), 0 4px 14px rgba(10,26,22,.05)',
        lift: '0 2px 6px rgba(10,26,22,.05), 0 14px 34px rgba(10,26,22,.08)',
        pop: '0 24px 60px rgba(10,26,22,.18)',
        bar: '0 -8px 24px rgba(10,26,22,.06)',
        hero: '0 18px 40px -18px rgb(var(--hero-from) / .65)',
        'primary-glow': '0 6px 16px -6px rgb(var(--primary-fill) / .55)',
        'coral-glow': '0 6px 16px -6px rgb(var(--coral-strong) / .6)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'pop-in': 'pop-in .16s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
