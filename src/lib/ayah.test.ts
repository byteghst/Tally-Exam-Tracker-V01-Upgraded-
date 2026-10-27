import { describe, expect, it } from 'vitest';
import { ayahOrder, ayahRef, dayNumber, pickAyahIndex, quranComUrl } from './ayah';

describe('ayah picker', () => {
  it('counts days from the date alone', () => {
    expect(dayNumber('1970-01-02') - dayNumber('1970-01-01')).toBe(1);
    expect(dayNumber('2026-10-28') - dayNumber('2026-10-27')).toBe(1);
  });

  it('gives a full permutation', () => {
    for (const n of [1, 2, 41, 100]) {
      expect([...ayahOrder(n)].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it('shows every entry once before repeating', () => {
    const n = 41;
    const start = dayNumber('2026-10-27');
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.UTC(1970, 0, 1 + start + i)).toISOString().slice(0, 10);
      seen.add(pickAyahIndex(n, d));
    }
    expect(seen.size).toBe(n);
  });

  it('is stable for the same date and safe for empty data', () => {
    expect(pickAyahIndex(41, '2026-10-27')).toBe(pickAyahIndex(41, '2026-10-27'));
    expect(pickAyahIndex(0, '2026-10-27')).toBe(-1);
  });

  it('formats references and links', () => {
    expect(ayahRef({ surah: 2, from: 255, to: 255 })).toBe('2:255');
    expect(ayahRef({ surah: 94, from: 5, to: 6 })).toBe('94:5–6');
    expect(quranComUrl({ surah: 94, from: 5, to: 6 })).toBe('https://quran.com/94/5-6');
  });
});
