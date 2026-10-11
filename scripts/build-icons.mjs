// Generates every app icon, the Android adaptive-icon layers and the launch
// screen from one drawing, so the logo can never drift between them.
//
// Runs automatically before every build (see "build" in package.json). Output:
//   public/icons/*      PWA / browser icons
//   resources/*         source images for `@capacitor/assets` (Android icon + splash)
//
// If the image library is unavailable for any reason this only warns and the
// build carries on with whatever icons already exist, it never fails a build.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const INK = '#1C1814';
const PAPER = '#F6F1E8';
const PERSIMMON = '#D94F2D';

/** The mark (three bars and a diagonal stroke), centred in a 512 box. */
function mark(scale) {
  return `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <g transform="translate(52.2 62.3) scale(1.27)">
      <rect x="69" y="50" width="38" height="205" fill="${PAPER}"/>
      <rect x="135" y="50" width="38" height="205" fill="${PAPER}"/>
      <rect x="201" y="50" width="38" height="205" fill="${PAPER}"/>
      <line x1="27" y1="202" x2="294" y2="83" stroke="${PERSIMMON}" stroke-width="34" stroke-linecap="square"/>
    </g>
  </g>`;
}

/** A square image: optional solid background (with optional rounded corners) plus the mark. */
function drawing({ size, background = null, radius = 0, markScale = 1 }) {
  const bg = background ? `<rect width="512" height="512" rx="${radius}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${bg}${markScale > 0 ? mark(markScale) : ''}</svg>`;
}

const JOBS = [
  // browser / PWA
  { file: 'public/icons/icon-192.png', size: 192, background: INK, radius: 112, markScale: 1 },
  { file: 'public/icons/icon-512.png', size: 512, background: INK, radius: 112, markScale: 1 },
  { file: 'public/icons/icon-512-maskable.png', size: 512, background: INK, radius: 0, markScale: 0.78 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, background: INK, radius: 0, markScale: 0.9 },
  // Android launcher (adaptive icon layers + legacy icon)
  { file: 'resources/icon.png', size: 1024, background: INK, radius: 0, markScale: 0.8 },
  { file: 'resources/icon-foreground.png', size: 1024, background: null, radius: 0, markScale: 0.68 },
  { file: 'resources/icon-background.png', size: 1024, background: INK, radius: 0, markScale: 0 },
  // Android launch screen
  { file: 'resources/splash.png', size: 2732, background: INK, radius: 0, markScale: 0.34 }
];

async function main() {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch (err) {
    console.warn('[icons] sharp is not available, keeping the existing icons:', err?.message ?? err);
    return;
  }

  for (const job of JOBS) {
    const svg = drawing(job);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    mkdirSync(dirname(job.file), { recursive: true });
    writeFileSync(job.file, png);
  }
  console.log(`[icons] generated ${JOBS.length} images`);
}

main().catch((err) => {
  console.warn('[icons] icon generation failed, keeping the existing icons:', err?.message ?? err);
});
