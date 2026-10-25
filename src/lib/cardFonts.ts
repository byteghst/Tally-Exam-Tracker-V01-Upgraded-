/**
 * The share cards (deadline, task, exam trend, monthly report) draw on a canvas
 * with font names written before the font changes: 'Instrument Serif' for big
 * type, 'Plus Jakarta Sans' for text and 'Tiro Bangla' for Bengali. Rather than
 * touch every card, those names are registered here so the cards pick up the
 * current faces automatically:
 *
 *   'Instrument Serif'  -> JetBrains Mono (medium; its real italic for italics)
 *   'Plus Jakarta Sans' -> JetBrains Mono, weights 400-700
 *   'Tiro Bangla'       -> Tiro Bangla (registered so it is loaded before a card draws)
 *
 * Plain text-drawing code only: nothing here affects the on-screen UI, which uses
 * the font stacks in tailwind.config.ts. If a font file can't be found the card
 * simply falls back to the browser's default for that name.
 */

const mono = import.meta.glob(
  '/node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-{400,500,600,700}-normal.woff2',
  { query: '?url', import: 'default', eager: true }
) as Record<string, string>;

const monoItalic = import.meta.glob(
  '/node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-italic.woff2',
  { query: '?url', import: 'default', eager: true }
) as Record<string, string>;

const bengali = import.meta.glob('/node_modules/@fontsource/tiro-bangla/files/tiro-bangla-bengali-400-normal.woff2', {
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
  add('Instrument Serif', find(mono, 'latin-500-normal.woff2'), { weight: '400', style: 'normal' });
  add('Instrument Serif', find(monoItalic, 'latin-500-italic.woff2'), { weight: '400', style: 'italic' });
  for (const weight of ['400', '500', '600', '700']) {
    add('Plus Jakarta Sans', find(mono, `latin-${weight}-normal.woff2`), { weight, style: 'normal' });
  }
  add('Tiro Bangla', find(bengali, 'bengali-400-normal.woff2'), { weight: '100 900', style: 'normal' });
}
