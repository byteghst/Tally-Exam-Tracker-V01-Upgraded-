import { describe, expect, it } from 'vitest';
import {
  buildAccentCss,
  contrastRatio,
  deriveShades,
  hexToRgb,
  hsvToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsv
} from './accent';

describe('normalizeHex', () => {
  it('accepts #RGB and #RRGGBB, with or without #', () => {
    expect(normalizeHex('#f80')).toBe('#FF8800');
    expect(normalizeHex('d94f2d')).toBe('#D94F2D');
    expect(normalizeHex('  #AbCdEf ')).toBe('#ABCDEF');
  });
  it('returns null for anything else', () => {
    for (const bad of ['', '#', '#12', '#12345', '#GGG', 'red', '#1234567']) expect(normalizeHex(bad)).toBeNull();
  });
});

describe('hsv round trip', () => {
  it('survives conversion', () => {
    for (const hex of ['#D94F2D', '#00FF00', '#123456', '#FFFFFF', '#000000']) {
      expect(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(hex))))).toBe(hex);
    }
  });
});

describe('deriveShades', () => {
  const colors = ['#FFFFFF', '#000000', '#FFFF00', '#0000FF', '#808080', '#D94F2D', '#101010', '#FEFEFE'];
  it('keeps text on the accent and accent-as-text readable in both themes, for any colour', () => {
    for (const hex of colors) {
      for (const mode of ['light', 'dark'] as const) {
        const s = deriveShades(hex, mode);
        expect(contrastRatio(s.on, s.accent)).toBeGreaterThanOrEqual(4.5);
        const surface = mode === 'light' ? [253, 251, 247] : [31, 28, 24];
        // the ink may be pushed to pure black/white, which always reads on these surfaces
        expect(contrastRatio(s.ink, surface as [number, number, number])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('never alters the chosen colour itself', () => {
    expect(rgbToHex(deriveShades('#12AB34', 'dark').accent)).toBe('#12AB34');
  });
});

describe('buildAccentCss', () => {
  it('covers both themes and the boot splash', () => {
    const css = buildAccentCss('#12AB34');
    expect(css).toContain('html:root{');
    expect(css).toContain('html.dark{');
    expect(css).toContain('#root .boot{--ac:#12AB34}');
    expect(css).toContain('--accent:18 171 52');
  });
});
