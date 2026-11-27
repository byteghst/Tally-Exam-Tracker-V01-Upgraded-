/**
 * Custom accent colour: the single source of truth.
 *
 * The person can pick any colour. From it we derive every shade the UI needs
 * (hover, pressed, soft tint, border, text-safe "ink" version, and the
 * black/white colour that sits on top of it) for BOTH the light and the dark
 * theme, and publish them as CSS variables. Everything in the app reads those
 * variables (via Tailwind's `accent` colours), so nothing else knows the hex.
 *
 * How it is applied
 * - A <style id="tally-accent-style"> holds `html:root{...}` (light) and
 *   `html.dark{...}` (dark). Because both themes are in the CSS, switching
 *   light/dark needs no JavaScript, and the rules beat the defaults in
 *   globals.css by specificity regardless of where the element is inserted.
 * - The finished CSS text is cached in localStorage. /accent-boot.js (a tiny
 *   classic script in <head>, allowed by the app's `script-src 'self'` policy)
 *   injects it before the first paint, so there is no flash of the default.
 * - With no custom colour nothing is injected and globals.css rules apply.
 *
 * The colour is never rejected. Where contrast is low, only the DERIVED
 * text/icon colours move (accent-ink, on-accent); the chosen colour itself is
 * used exactly as picked for fills, charts and borders.
 */

export type Rgb = [number, number, number];
export interface Hsv {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
}
export type AccentMode = 'light' | 'dark';

export const ACCENT_STORAGE_KEY = 'tally-accent-v1';
export const ACCENT_CSS_STORAGE_KEY = 'tally-accent-css-v1';
export const ACCENT_STYLE_ID = 'tally-accent-style';
/** Dispatched on `window` after the accent changes (canvas/chart code listens). */
export const ACCENT_EVENT = 'tally:accent-changed';

/** The built-in persimmon, as in globals.css. Used by "Reset" and by canvas cards. */
export const DEFAULT_ACCENT_LIGHT = '#D94F2D';
export const DEFAULT_ACCENT_DARK = '#FF7A54';

/** Surface colours of each theme. Keep in step with --surface, --surface-raised and --ink in globals.css. */
const SURFACES: Record<AccentMode, { page: Rgb; raised: Rgb; ink: Rgb }> = {
  light: { page: [240, 234, 222], raised: [253, 251, 247], ink: [28, 24, 20] },
  dark: { page: [16, 14, 12], raised: [31, 28, 24], ink: [245, 238, 227] }
};

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [20, 16, 12];

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Accepts #RGB or #RRGGBB (the leading # is optional, case does not matter)
 * and returns the canonical "#RRGGBB", or null if the text is not a hex colour.
 */
export function normalizeHex(input: string): string | null {
  const m = /^\s*#?([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(input);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return `#${h.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const n = normalizeHex(hex) ?? DEFAULT_ACCENT_LIGHT;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const part = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export const rgbTriplet = ([r, g, b]: Rgb): string => `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;

export function rgbToHsv([r, g, b]: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio, 1 (none) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** `t` of the way from a to b. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Black or white (a warm near-black), whichever reads better on top of `bg`. */
export function onColor(bg: Rgb): Rgb {
  return contrastRatio(WHITE, bg) >= contrastRatio(BLACK, bg) ? WHITE : BLACK;
}

/**
 * Nudges `fg` towards black (light theme) or white (dark theme), keeping its
 * hue, until it reaches `min` contrast on every background in `bgs`. A colour
 * that already passes is returned untouched.
 */
export function readableOn(fg: Rgb, bgs: Rgb[], min: number, mode: AccentMode): Rgb {
  const worst = (c: Rgb) => Math.min(...bgs.map((bg) => contrastRatio(c, bg)));
  if (worst(fg) >= min) return fg;
  const [h, s, l] = rgbToHsl(fg);
  const dir = mode === 'light' ? -1 : 1;
  for (let i = 1; i <= 100; i++) {
    const candidate = hslToRgb([h, s, clamp(l + (dir * i) / 100, 0, 1)]);
    if (worst(candidate) >= min) return candidate;
  }
  return dir < 0 ? [0, 0, 0] : [255, 255, 255];
}

function shiftLightness(rgb: Rgb, delta: number): Rgb {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb([h, s, clamp(l + delta, 0, 1)]);
}

// ---------------------------------------------------------------------------
// Derived shades
// ---------------------------------------------------------------------------

export interface AccentShades {
  accent: Rgb;
  hover: Rgb;
  pressed: Rgb;
  soft: Rgb;
  border: Rgb;
  /** The accent made readable as text or an icon on the theme's surfaces. */
  ink: Rgb;
  /** Text/icon colour that sits on top of a solid accent fill. */
  on: Rgb;
}

export function deriveShades(hex: string, mode: AccentMode): AccentShades {
  const accent = hexToRgb(hex);
  const { page, raised } = SURFACES[mode];

  const [, , l] = rgbToHsl(accent);
  // Light colours can't get lighter, so their hover goes darker instead.
  const hover = shiftLightness(accent, l > 0.85 ? -0.05 : 0.05);
  const pressed = shiftLightness(accent, l > 0.85 ? -0.11 : -0.06);

  const soft = mix(raised, accent, mode === 'light' ? 0.14 : 0.22);
  const border = mix(raised, accent, mode === 'light' ? 0.38 : 0.5);
  const ink = readableOn(accent, [page, raised, soft], 4.5, mode);
  const on = onColor(accent);

  return { accent, hover, pressed, soft, border, ink, on };
}

function declarations(s: AccentShades): string {
  return [
    `--accent:${rgbTriplet(s.accent)}`,
    `--accent-hover:${rgbTriplet(s.hover)}`,
    `--accent-pressed:${rgbTriplet(s.pressed)}`,
    `--accent-soft:${rgbTriplet(s.soft)}`,
    `--accent-border:${rgbTriplet(s.border)}`,
    `--accent-ink:${rgbTriplet(s.ink)}`,
    `--on-accent:${rgbTriplet(s.on)}`
  ].join(';');
}

/** The complete stylesheet for a chosen colour (both themes, plus the boot screen). */
export function buildAccentCss(hex: string): string {
  const n = normalizeHex(hex) ?? DEFAULT_ACCENT_LIGHT;
  const light = deriveShades(n, 'light');
  const dark = deriveShades(n, 'dark');
  // `html:root` and `html.dark` are more specific than globals.css's `:root` and `.dark`.
  // The boot splash (index.html) picks light/dark from the phone's setting, so it gets both too.
  // `#root .boot` outranks the splash's own `.boot` rule, which sits later in <head>.
  return (
    `html:root{${declarations(light)}}` +
    `html.dark{${declarations(dark)}}` +
    `#root .boot{--ac:${rgbToHex(light.accent)}}` +
    `@media (prefers-color-scheme:dark){#root .boot{--ac:${rgbToHex(dark.accent)}}}`
  );
}

export interface CardAccent {
  /** Exact colour for lines, bars, fills. */
  accent: string;
  /** Readable version for text drawn in the accent colour. */
  ink: string;
  /** Soft tint for area fills and chips. */
  soft: string;
}

/**
 * Accent colours for canvas drawings (share cards, the PDF report). Canvas
 * can't read CSS variables, and a card has its own fixed background (`bg`),
 * so the shades are worked out against that background instead. With no custom
 * accent the original literal colours are returned, so the cards don't change.
 */
const cardCache = new Map<string, CardAccent>();

export function cardAccent(mode: AccentMode, bgHex: string, defaults: { soft: string }): CardAccent {
  const custom = getAccent();
  const key = `${custom}|${mode}|${bgHex}|${defaults.soft}`;
  const hit = cardCache.get(key);
  if (hit) return hit;

  let result: CardAccent;
  if (!custom) {
    const base = mode === 'light' ? DEFAULT_ACCENT_LIGHT : DEFAULT_ACCENT_DARK;
    result = { accent: base, ink: base, soft: defaults.soft };
  } else {
    const accent = hexToRgb(custom);
    const bg = hexToRgb(bgHex);
    result = {
      accent: rgbToHex(accent),
      ink: rgbToHex(readableOn(accent, [bg], 4.5, mode)),
      soft: rgbToHex(mix(bg, accent, mode === 'light' ? 0.14 : 0.22))
    };
  }
  if (cardCache.size > 50) cardCache.clear();
  cardCache.set(key, result);
  return result;
}

/** "rgba(r,g,b,a)" from a #RRGGBB colour. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// State: persistence + applying to the page
// ---------------------------------------------------------------------------

let current: string | null = null;
let initialised = false;
const listeners = new Set<() => void>();
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

function readStored(): string | null {
  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY);
    return raw ? normalizeHex(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(hex: string | null): void {
  try {
    if (hex) {
      localStorage.setItem(ACCENT_STORAGE_KEY, hex);
      localStorage.setItem(ACCENT_CSS_STORAGE_KEY, buildAccentCss(hex));
    } else {
      localStorage.removeItem(ACCENT_STORAGE_KEY);
      localStorage.removeItem(ACCENT_CSS_STORAGE_KEY);
    }
  } catch {
    // storage full or blocked: the colour still applies for this session
  }
}

function paint(hex: string | null): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(ACCENT_STYLE_ID);
  if (!hex) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = ACCENT_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildAccentCss(hex);
}

function animateChange(): void {
  const root = document.documentElement;
  root.classList.add('accent-transition');
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove('accent-transition');
    transitionTimer = null;
  }, 320);
}

function announce(): void {
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACCENT_EVENT));
}

/** The chosen colour as "#RRGGBB", or null when the built-in persimmon is in use. */
export function getAccent(): string | null {
  if (!initialised && typeof localStorage !== 'undefined') current = readStored();
  return current;
}

export function subscribeAccent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Sets the accent. Any valid hex works; invalid text is ignored (callers show
 * their own hint, nothing is "rejected" in the UI). Applies live, no reload.
 * Pass `animate: false` while dragging so the colour follows the finger without lag.
 */
export function setAccent(input: string, options: { animate?: boolean } = {}): void {
  const hex = normalizeHex(input);
  if (!hex) return;
  initialised = true;
  if (hex === current) return;
  if (options.animate !== false) animateChange();
  current = hex;
  paint(hex);
  writeStored(hex);
  announce();
}

/** Back to the built-in persimmon. */
export function resetAccent(): void {
  initialised = true;
  if (current === null) return;
  animateChange();
  current = null;
  paint(null);
  writeStored(null);
  announce();
}

/**
 * The colour currently showing: the chosen one, or the built-in default for
 * the theme in use. Used to place the picker where the colour already is.
 */
export function getEffectiveAccentHex(): string {
  const custom = getAccent();
  if (custom) return custom;
  if (typeof document === 'undefined') return DEFAULT_ACCENT_LIGHT;
  return document.documentElement.classList.contains('dark') ? DEFAULT_ACCENT_DARK : DEFAULT_ACCENT_LIGHT;
}

/**
 * Call once at startup. /accent-boot.js has normally already painted the
 * saved colour before first paint; this re-applies it (keeping the cached CSS
 * fresh if the shade maths ever changes) and starts listening for other tabs.
 */
export function initAccent(): void {
  if (initialised) return;
  initialised = true;
  current = readStored();
  paint(current);
  if (current) writeStored(current);

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== ACCENT_STORAGE_KEY) return;
      const next = e.newValue ? normalizeHex(e.newValue) : null;
      if (next === current) return;
      current = next;
      paint(next);
      announce();
    });
  }
}
