/**
 * Technor (English) and FN Shorif Shadhin (Bengali) are served from
 * public/fonts/, not from npm. They are registered here at start-up rather than
 * in CSS, so the path follows the site's base URL (GitHub Pages serves from a
 * sub-folder).
 *
 * If a file is missing the load simply fails and the text uses the next font in
 * the stack (the handwritten faces bundled from npm), so nothing breaks.
 *
 *   public/fonts/Technor-Variable.woff2       variable weight 200-900, Latin only
 *   public/fonts/ShorifShadhin-Bengali.woff   Bengali letters only (a subset)
 */

const BASE = import.meta.env.BASE_URL;

export const FONT_FILES = {
  technor: `${BASE}fonts/Technor-Variable.woff2`,
  shorif: `${BASE}fonts/ShorifShadhin-Bengali.woff`
} as const;

export const BENGALI_RANGE = 'U+0980-09FF, U+0964-0965, U+200C-200D';

function load(family: string, url: string, descriptors: FontFaceDescriptors): void {
  new FontFace(family, `url(${url})`, descriptors)
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => {
      // file not uploaded yet: the fallback fonts in the stack are used
    });
}

export function registerAppFonts(): void {
  if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') return;
  load('Technor', FONT_FILES.technor, { weight: '200 900', style: 'normal' });
  load('Shorif Shadhin', FONT_FILES.shorif, { weight: '100 900', style: 'normal', unicodeRange: BENGALI_RANGE });
}
