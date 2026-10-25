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
      // Technor for English, FN Shorif Shadhin for Bengali (both served from
      // public/fonts, see lib/appFonts.ts). Technor has no Bengali letters, so the
      // browser takes Bengali from Shorif Shadhin. Patrick Hand, Caveat and Atma
      // stay at the end of each stack as the fallback until the files are uploaded.
      fontFamily: {
        // UI + body text
        sans: ['"Technor"', '"Shorif Shadhin"', '"Patrick Hand"', '"Atma"', 'cursive', 'sans-serif'],
        // small headings (existing `font-display` usages pick this up everywhere)
        display: ['"Technor"', '"Shorif Shadhin"', '"Patrick Hand"', '"Atma"', 'cursive', 'sans-serif'],
        // numerals: scores, countdowns, stats
        numeric: ['"Space Grotesk"', '"Shorif Shadhin"', '"Atma"', 'system-ui', 'sans-serif'],
        // Large headings: greetings, page titles, big numbers.
        // The class is still called `font-serif` in the markup; it is Technor now.
        serif: ['"Technor"', '"Shorif Shadhin"', '"Caveat"', '"Atma"', 'cursive', 'sans-serif']
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
