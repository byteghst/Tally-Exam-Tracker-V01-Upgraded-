/**
 * The share cards (deadline, task, exam trend, monthly report) draw on a canvas
 * with font names written before the font change: 'Instrument Serif' for big
 * type, 'Plus Jakarta Sans' for text and 'Tiro Bangla' for Bengali. Rather than
 * touch every card, those names are registered here as aliases for the current
 * faces (Outfit, DM Sans, Hind Siliguri), so the cards pick them up
 * automatically. Italic big type uses DM Sans italic.
 *
 * Plain text-drawing code only: nothing here affects the on-screen UI, which uses
 * the font stacks in tailwind.config.ts. If a font file can't be found the card
 * simply falls back to the browser's default for that name.
 */

const display = import.meta.glob('/node_modules/@fontsource/outfit/files/outfit-latin-400-normal.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const text = import.meta.glob(
  '/node_modules/@fontsource/dm-sans/files/dm-sans-latin-{400,500,600,700}-normal.woff2',
  { query: '?url', import: 'default', eager: true }
) as Record<string, string>;

const italic = import.meta.glob('/node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-italic.woff2', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const bengali = import.meta.glob(
  '/node_modules/@fontsource/hind-siliguri/files/hind-siliguri-bengali-500-normal.woff2',
  { query: '?url', import: 'default', eager: true }
) as Record<string, string>;

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
  add('Instrument Serif', find(display, 'latin-400-normal.woff2'), { weight: '400', style: 'normal' });
  add('Instrument Serif', find(italic, 'latin-400-italic.woff2'), { weight: '400', style: 'italic' });
  for (const weight of ['400', '500', '600', '700']) {
    add('Plus Jakarta Sans', find(text, `latin-${weight}-normal.woff2`), { weight, style: 'normal' });
  }
  add('Tiro Bangla', find(bengali, 'bengali-500-normal.woff2'), { weight: '100 900', style: 'normal' });
}
