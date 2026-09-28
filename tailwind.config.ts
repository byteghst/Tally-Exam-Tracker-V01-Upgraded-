import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)'
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)'
        },
        accent2: {
          DEFAULT: 'rgb(var(--accent2) / <alpha-value>)'
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        success: '#3EBD7E',
        warning: '#E0A93E',
        danger: '#E0645E'
      },
      fontFamily: {
        // UI + body text
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        // headings (existing `font-display` usages pick this up everywhere)
        display: ['"Fraunces"', 'Georgia', 'serif'],
        // numerals: scores, countdowns, stats
        numeric: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // quiet accent: italic taglines, small flourishes
        serif: ['"Instrument Serif"', 'Georgia', 'serif']
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)'
      },
      backdropBlur: {
        glass: 'var(--blur)'
      },
      boxShadow: {
        glass: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
        'glass-lg': '0 2px 4px rgb(0 0 0 / 0.05), 0 24px 60px -18px rgb(0 0 0 / 0.35)'
      },
      backgroundImage: {
        'app-gradient':
          'radial-gradient(120% 90% at 15% -10%, rgb(var(--accent) / 0.16), transparent 55%), radial-gradient(110% 90% at 100% 0%, rgb(var(--accent2) / 0.14), transparent 60%), radial-gradient(140% 100% at 50% 120%, rgb(var(--accent) / 0.08), transparent 60%)'
      },
      spacing: {
        'safe-top': 'max(env(safe-area-inset-top), 14px)',
        'safe-bottom': 'max(env(safe-area-inset-bottom), 14px)'
      }
    }
  },
  plugins: []
} satisfies Config;
