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
        // Persimmon: the main accent. `on` = text colour that sits on top of it.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          on: 'rgb(var(--on-accent) / <alpha-value>)'
        },
        // Supporting accents, used for categories, charts and states.
        forest: 'rgb(var(--forest) / <alpha-value>)',
        saffron: 'rgb(var(--saffron) / <alpha-value>)',
        rose: 'rgb(var(--rose) / <alpha-value>)',
        accent2: 'rgb(var(--saffron) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        success: 'rgb(var(--forest) / <alpha-value>)',
        warning: 'rgb(var(--saffron) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)'
      },
      // Every stack ends with Tiro Bangla before the generic fallbacks. The Latin
      // fonts have no Bengali letters, so the browser picks Tiro Bangla for any
      // Bengali text, whichever font the surrounding text uses.
      fontFamily: {
        // UI + body text
        sans: ['"Plus Jakarta Sans"', '"Tiro Bangla"', 'system-ui', 'sans-serif'],
        // headings (existing `font-display` usages pick this up everywhere)
        display: ['"Fraunces"', '"Tiro Bangla"', 'Georgia', 'serif'],
        // numerals: scores, countdowns, stats
        numeric: ['"Space Grotesk"', '"Tiro Bangla"', 'system-ui', 'sans-serif'],
        // large editorial type: greetings, big numbers, italic taglines
        serif: ['"Instrument Serif"', '"Tiro Bangla"', 'Georgia', 'serif']
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)'
      },
      // Flat design: no blur and no shadows anywhere. These keys remain only so
      // class names in not-yet-redesigned files still resolve (to nothing).
      backdropBlur: {
        glass: 'var(--blur)'
      },
      boxShadow: {
        glass: 'none',
        'glass-lg': 'none'
      },
      backgroundImage: {
        'app-gradient': 'none'
      },
      spacing: {
        'safe-top': 'max(env(safe-area-inset-top), 14px)',
        'safe-bottom': 'max(env(safe-area-inset-bottom), 14px)'
      }
    }
  },
  plugins: []
} satisfies Config;
