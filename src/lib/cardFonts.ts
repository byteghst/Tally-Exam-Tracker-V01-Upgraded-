/**
 * The share cards (deadline, task, exam trend, monthly report) draw on a canvas
 * with font names written before the serif faces were dropped: 'Instrument Serif'
 * for big type and 'Tiro Bangla' for Bengali. Rather than touch every card, those
 * two names are registered here as aliases for the current faces, so the cards
 * pick up Instrument Sans and Hind Siliguri automatically.
 *
 * Plain text-drawing code only: nothing here affects the on-screen UI, which uses
 * the font stacks in tailwind.config.ts. If a font file can't be found the card
 * simply falls back to the browser's default for that name.
 */

const latin = import.meta.glob('/node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-500-*.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const bengali = import.meta.glob('/node_modules/@fontsource/hind-siliguri/files/hind-siliguri-bengali-500-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

function find(files: Record<string, string>, ending: string): string | undefined {
  const key = Object.keys(files).find((k) => k.endsWith(ending));
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
  // The medium cut stands in for the card's regular weight, which reads better at poster sizes.
  add('Instrument Serif', find(latin, 'latin-500-normal.woff2'), { weight: '400', style: 'normal' });
  add('Instrument Serif', find(latin, 'latin-500-italic.woff2'), { weight: '400', style: 'italic' });
  add('Tiro Bangla', find(bengali, 'bengali-500-normal.woff2'), { weight: '100 900', style: 'normal' });
}
