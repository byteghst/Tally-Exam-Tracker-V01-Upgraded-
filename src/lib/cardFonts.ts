/**
 * The share cards (deadline, task, exam trend, monthly report) draw on a canvas
 * with font names written before the font changes: 'Instrument Serif' for big
 * type, 'Plus Jakarta Sans' for text and 'Tiro Bangla' for Bengali. Rather than
 * touch every card, those names are registered here as aliases for the current
 * faces (Caveat, Patrick Hand, Atma), so the cards pick them up automatically.
 * Patrick Hand has a single weight, so it is registered under every weight the
 * cards ask for (no smeared fake bold), and its upright cut stands in for italic.
 *
 * Plain text-drawing code only: nothing here affects the on-screen UI, which uses
 * the font stacks in tailwind.config.ts. If a font file can't be found the card
 * simply falls back to the browser's default for that name.
 */

const display = import.meta.glob('/node_modules/@fontsource/caveat/files/caveat-latin-600-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const text = import.meta.glob('/node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const bengali = import.meta.glob('/node_modules/@fontsource/atma/files/atma-bengali-500-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

function first(files: Record<string, string>): string | undefined {
  const key = Object.keys(files)[0];
  return key ? files[key] : undefined;
}

function add(family: string, url: string | undefined, descriptors: FontFaceDescriptors): void {
  if (!url) return;
  new FontFace(family, `url(${url})`, descriptors)
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => {
      // cosmetic only: the card falls back to a default font
    });
}

export function registerCardFonts(): void {
  if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') return;
  const big = first(display);
  add('Instrument Serif', big, { weight: '400', style: 'normal' });
  add('Instrument Serif', first(text), { weight: '400', style: 'italic' });
  for (const weight of ['400', '500', '600', '700']) {
    add('Plus Jakarta Sans', first(text), { weight, style: 'normal' });
  }
  add('Tiro Bangla', first(bengali), { weight: '100 900', style: 'normal' });
}
