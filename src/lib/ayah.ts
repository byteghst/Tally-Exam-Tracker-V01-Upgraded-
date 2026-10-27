export interface AyahVerse {
  n: number;
  ar: string;
  en: string;
  bn: string;
}

export interface AyahEntry {
  id: string;
  surah: number;
  surahName: string;
  from: number;
  to: number;
  verses: AyahVerse[];
}

export interface AyahSourceMeta {
  tanzilId: string;
  label: string;
  notice: string[];
}

export interface AyahData {
  meta: { sources: { ar: AyahSourceMeta; en: AyahSourceMeta; bn: AyahSourceMeta } };
  entries: AyahEntry[];
}

/** Whole days since 1970 for a local 'YYYY-MM-DD' date. */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function hash(i: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** A fixed shuffled order of 0..n-1, identical on every device. */
export function ayahOrder(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i).sort((a, b) => hash(a) - hash(b) || a - b);
}

/**
 * Which entry to show on a given date. Every entry is shown once before any
 * repeats, and the same date gives the same entry on every device (no storage).
 */
export function pickAyahIndex(count: number, iso: string): number {
  if (count <= 0) return -1;
  return ayahOrder(count)[((dayNumber(iso) % count) + count) % count];
}

export function ayahRef(e: Pick<AyahEntry, 'surah' | 'from' | 'to'>): string {
  return e.to > e.from ? `${e.surah}:${e.from}–${e.to}` : `${e.surah}:${e.from}`;
}

export function quranComUrl(e: Pick<AyahEntry, 'surah' | 'from' | 'to'>): string {
  return `https://quran.com/${e.surah}/${e.to > e.from ? `${e.from}-${e.to}` : e.from}`;
}

// The data file is generated at build time from the Tanzil files (see
// scripts/build-ayah-data.mjs). import.meta.glob returns nothing when the file
// does not exist, so the widget simply hides instead of breaking the build.
const loaders = import.meta.glob('../data/ayah-data.json');
let cache: Promise<AyahData | null> | null = null;

export function loadAyahData(): Promise<AyahData | null> {
  if (!cache) {
    const load = loaders['../data/ayah-data.json'];
    cache = load
      ? load().then((m) => (m as { default: AyahData }).default).catch(() => null)
      : Promise.resolve(null);
  }
  return cache;
}
