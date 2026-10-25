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
      // The original combination: Plus Jakarta Sans for text, Fraunces for small
      // headings, Instrument Serif for large editorial type, Space Grotesk for
      // numerals. Tiro Bangla supplies Bengali letters, which the Latin fonts lack.
      fontFamily: {
        // UI + body text
        sans: ['"Plus Jakarta Sans"', '"Tiro Bangla"', 'system-ui', 'sans-serif'],
        // small headings (existing `font-display` usages pick this up everywhere)
        display: ['"Fraunces"', '"Tiro Bangla"', 'Georgia', 'serif'],
        // numerals: scores, countdowns, stats
        numeric: ['"Space Grotesk"', '"Tiro Bangla"', 'system-ui', 'sans-serif'],
        // Large editorial type: greetings, page titles, big numbers, italic taglines.
        serif: ['"Instrument Serif"', '"Tiro Bangla"', 'Georgia', 'serif']
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)'
      },
      // Soft tonal design: surfaces are told apart by fill and a gentle, diffuse
      // shadow, never by outlines. `soft` = resting card, `raise` = pressed/hovered
      // card, `sheet` = panels that slide up over the page.
      boxShadow: {
        soft: '0 1px 2px rgb(var(--shadow) / 0.05), 0 8px 24px -10px rgb(var(--shadow) / 0.12)',
        raise: '0 2px 4px rgb(var(--shadow) / 0.06), 0 16px 32px -12px rgb(var(--shadow) / 0.2)',
        sheet: '0 -10px 40px -12px rgb(var(--shadow) / 0.25)',
        // legacy keys, still resolve to nothing for not-yet-redesigned files
        glass: 'none',
        'glass-lg': 'none'
      },
      // Blur stays switched off.
      backdropBlur: {
        glass: 'var(--blur)'
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
