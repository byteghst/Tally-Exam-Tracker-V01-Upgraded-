// Generates every app icon, the Android adaptive-icon layers and the launch
// screen from one drawing, so the logo can never drift between them.
//
// The drawing is the original Tally logo: pure black, four white bars and one
// orange stroke. Coordinates below are measured from the original artwork
// (1254 x 1254), so it is reproduced exactly.
//
// Runs automatically before every build (see "build" in package.json). Output:
//   public/icons/*      PWA / browser icons
//   resources/*         source images for `@capacitor/assets` (Android icon + splash)
//
// If the image library is unavailable for any reason this only warns and the
// build carries on with whatever icons already exist, it never fails a build.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BLACK = '#000000';
const WHITE = '#FFFFFF';
const ORANGE = '#FE5018';
const BOX = 1254; // size of the original artwork
const CENTER = BOX / 2;

/**
 * The mark, scaled around the centre of the artwork box.
 * The white bars use crispEdges so their straight edges land exactly on pixel
 * boundaries at every icon size (no soft, blurry sides); the diagonal stays
 * anti-aliased.
 */
function mark(scale) {
  return `
  <g transform="translate(${CENTER} ${CENTER}) scale(${scale}) translate(${-CENTER} ${-CENTER})">
    <g shape-rendering="crispEdges" fill="${WHITE}">
      <rect x="376" y="316" width="92" height="611"/>
      <rect x="515" y="316" width="89" height="611"/>
      <rect x="651" y="316" width="88" height="611"/>
      <rect x="787" y="316" width="91" height="611"/>
    </g>
    <polygon points="248,702 1006,374 1006,474 248,801" fill="${ORANGE}"/>
  </g>`;
}

/** A square image: optional solid background (with optional rounded corners) plus the mark. */
function drawing({ size, background = null, radius = 0, markScale = 1 }) {
  const bg = background ? `<rect width="${BOX}" height="${BOX}" rx="${radius}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${BOX} ${BOX}">${bg}${markScale > 0 ? mark(markScale) : ''}</svg>`;
}

const ROUND = 274; // corner radius for the rounded tile, in artwork units

// markScale 1 = the artwork exactly as drawn (the mark is about 60% of the tile
// wide). Android only shows the middle two thirds of the adaptive-icon layer and
// of the launch icon (a circle), so those are sized to fill that circle as far
// as it allows without the corners of the bars being cut off.
const JOBS = [
  // browser / PWA
  { file: 'public/icons/icon-192.png', size: 192, background: BLACK, radius: ROUND, markScale: 1.12 },
  { file: 'public/icons/icon-512.png', size: 512, background: BLACK, radius: ROUND, markScale: 1.12 },
  { file: 'public/icons/icon-512-maskable.png', size: 512, background: BLACK, radius: 0, markScale: 1.05 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, background: BLACK, radius: 0, markScale: 1.1 },
  // Android launcher (adaptive icon layers + legacy icon)
  { file: 'resources/icon.png', size: 1024, background: BLACK, radius: 0, markScale: 0.9 },
  { file: 'resources/icon-foreground.png', size: 1024, background: null, radius: 0, markScale: 0.91 },
  { file: 'resources/icon-background.png', size: 1024, background: BLACK, radius: 0, markScale: 0 },
  // Android launch screen
  { file: 'resources/splash.png', size: 2732, background: BLACK, radius: 0, markScale: 0.6 }
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
