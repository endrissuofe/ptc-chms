/** Colours and type from the Stitch "Peculiar Sanctuary" design system (docs/design/DESIGN.md). */
/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F3EC',
        surface: '#FFFFFF',
        ink: '#1D2238',
        muted: '#5B6070',
        line: '#E4DED2',
        primary: { DEFAULT: '#B5541C', dark: '#953D01' },
        secondary: { DEFAULT: '#1F6E62', dark: '#196A5E' },
        tertiary: '#6C4B82',
        danger: { DEFAULT: '#C83226', subtle: '#FDEDEC' },
        stage: {
          'first-bg': '#FDF2EC',
          'first-text': '#B5541C',
          'second-bg': '#ECEEF5',
          'second-text': '#1D2238',
          'regular-bg': '#E8F4F1',
          'regular-text': '#17564D',
          'class-bg': '#F3EDF7',
          'class-text': '#543866',
          'member-bg': '#1F6E62',
          'member-text': '#FFFFFF',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
