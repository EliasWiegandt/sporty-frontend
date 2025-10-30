/**
 * Sporty Tailwind preset
 * ----------------------
 *
 * This file mirrors the design tokens defined in `src/styles/tailwind.css`.
 * Projects that want to share the Sporty theme can import this preset
 * and spread it into their Tailwind configuration:
 *
 *    import sportyPreset from './tailwind.sporty-preset.mjs';
 *    export default {
 *      presets: [sportyPreset],
 *      content: ['src/**/*.{astro,tsx,jsx,ts,js}'],
 *    };
 *
 * Tokens reference CSS variables so changes flow through automatically.
 */

const colors = {
  brand: {
    50: 'var(--color-brand-50)',
    100: 'var(--color-brand-100)',
    200: 'var(--color-brand-200)',
    300: 'var(--color-brand-300)',
    400: 'var(--color-brand-400)',
    500: 'var(--color-brand-500)',
    600: 'var(--color-brand-600)',
    700: 'var(--color-brand-700)',
    800: 'var(--color-brand-800)',
    900: 'var(--color-brand-900)',
    950: 'var(--color-brand-950)',
    DEFAULT: 'var(--color-brand-600)',
  },
  surface: 'var(--color-surface)',
  surfaceMuted: 'var(--color-surface-muted)',
  text: 'var(--color-text)',
  textMuted: 'var(--color-text-muted)',
  textSoft: 'var(--color-text-soft)',
  border: 'var(--color-border)',
  borderStrong: 'var(--color-border-strong)',
  backdrop: 'var(--color-backdrop)',
  info: 'var(--color-info)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

const borderRadius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  '3xl': 'var(--radius-3xl)',
  '4xl': 'var(--radius-4xl)',
  full: 'var(--radius-pill)',
};

const spacing = {
  15: 'var(--spacing-15)',
  18: 'var(--spacing-18)',
  20: 'var(--spacing-20)',
  22: 'var(--spacing-22)',
  24: 'var(--spacing-24)',
  28: 'var(--spacing-28)',
};

const boxShadow = {
  soft: 'var(--shadow-soft)',
  button: 'var(--shadow-button)',
  card: 'var(--shadow-card)',
  section: 'var(--shadow-section)',
  focus: 'var(--shadow-focus)',
};

const fontFamily = {
  sans: 'var(--font-sans)',
  heading: 'var(--font-heading)',
  display: 'var(--font-display)',
};

const sportyPreset = {
  theme: {
    colors,
    borderRadius,
    spacing,
    boxShadow,
    fontFamily,
  },
};

export default sportyPreset;
