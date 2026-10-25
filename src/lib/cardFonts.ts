import { BENGALI_RANGE, FONT_FILES } from './appFonts';

/**
 * The share cards (deadline, task, exam trend, monthly report) draw on a canvas
 * with font names written before the font changes: 'Instrument Serif' for big
 * type, 'Plus Jakarta Sans' for text and 'Tiro Bangla' for Bengali. Rather than
 * touch every card, those names are registered here as aliases for the current
 * faces, so the cards pick them up automatically:
 *
 *   big type, text   -> Technor (public/fonts), italic requests use the upright cut
 *   Bengali          -> FN Shorif Shadhin (public/fonts)
 *
 * If a font file in public/fonts is missing, the alias falls back to the
 * handwritten faces bundled from npm (Caveat, Patrick Hand, Atma), so cards
 * still render.
 *
 * Plain text-drawing code only: nothing here affects the on-screen UI, which uses
 * the font stacks in tailwind.config.ts.
 */

const caveat = import.meta.glob('/node_modules/@fontsource/caveat/files/caveat-latin-600-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const patrick = import.meta.glob('/node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const atma = import.meta.glob('/node_modules/@fontsource/atma/files/atma-bengali-500-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

function first(files: Record<string, string>): string | undefined {
  const key = Object.keys(files)[0];
  return key ? files[key] : undefined;
}

function add(family: string, url: string, descriptors: FontFaceDescriptors, fallbackUrl?: string): void {
  new FontFace(family, `url(${url})`, descriptors)
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => {
      if (!fallbackUrl) return;
      new FontFace(family, `url(${fallbackUrl})`, descriptors)
        .load()
        .then((face) => document.fonts.add(face))
        .catch(() => {
          // cosmetic only: the card falls back to a default font
        });
    });
}

export function registerCardFonts(): void {
  if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') return;
  const big = first(caveat);
  const body = first(patrick);
  const bn = first(atma);

  add('Instrument Serif', FONT_FILES.technor, { weight: '400', style: 'normal' }, big);
  add('Instrument Serif', FONT_FILES.technor, { weight: '400', style: 'italic' }, body);
  add('Plus Jakarta Sans', FONT_FILES.technor, { weight: '200 900', style: 'normal' }, body);
  add('Tiro Bangla', FONT_FILES.shorif, { weight: '100 900', style: 'normal', unicodeRange: BENGALI_RANGE }, bn);
}
