import type { ExamTrendPoint } from '@/lib/examTrend';
import { formatDate } from '@/lib/dates';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

// Brand tokens (kept as literal hex here rather than reading CSS variables,
// since canvas drawing happens outside the CSS cascade entirely).
// accent = the logo's blue (#0055FE).
const COLOR = {
  bg: '#F2F3F6',
  ink: '#0F1216',
  inkMuted: '#5A6374',
  inkFaint: '#96A0AD',
  accent: '#0055FE',
  accentSoft: '#E6EEFF',
  success: '#3EBD7E',
  border: '#E0E4EB',
  white: '#FFFFFF'
};

// Same font roles as the app itself (bundled via @fontsource in main.tsx).
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_NUMERIC = "'Space Grotesk', system-ui, sans-serif";
const FONT_UI = "'Plus Jakarta Sans', system-ui, sans-serif";

// Every font spec the card draws with. Canvas text does NOT trigger web-font
// loading by itself (only text in the page does), so these are loaded
// explicitly before the first frame — otherwise the card can silently fall
// back to a system font.
const CARD_FONT_SPECS = [
  `600 34px ${FONT_DISPLAY}`,
  `700 48px ${FONT_DISPLAY}`,
  `700 64px ${FONT_NUMERIC}`,
  `400 26px ${FONT_UI}`,
  `500 19px ${FONT_UI}`,
  `500 20px ${FONT_UI}`,
  `600 20px ${FONT_UI}`,
  `600 22px ${FONT_UI}`
];

// Header logo: the real Tally logo image, drawn as-is (not redrawn from shapes).
const LOGO_SIZE = 56;
const LOGO_GAP = 18;

let logoPromise: Promise<HTMLImageElement | null> | null = null;

/**
 * Loads the Tally logo once (the same PNG used for the app icon, so the
 * card can never drift from the real logo). Resolves to null if it can't be
 * loaded, so the card still renders instead of failing.
 */
export function loadTallyLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        logoPromise = null; // allow a retry next time the card is opened
        resolve(null);
      };
      img.src = '/icons/icon-512.png';
    });
  }
  return logoPromise;
}

/** Loads fonts + logo needed to draw the card. Call once before the first frame. */
export async function prepareCardAssets(): Promise<HTMLImageElement | null> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.all(CARD_FONT_SPECS.map((spec) => document.fonts.load(spec)));
      await document.fonts.ready;
    } catch {
      // proceed with whatever's loaded — a fallback font beats no card
    }
  }
  return loadTallyLogo();
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface ExamTrendCardStats {
  latest: number;
  highest: number;
  average: number;
}

export function computeCardStats(points: ExamTrendPoint[]): ExamTrendCardStats {
  const values = points.map((p) => p.percentage);
  return {
    latest: values[values.length - 1],
    highest: Math.max(...values),
    average: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  };
}

/** Picks a readable subset of x-axis tick labels so they never overlap on narrow point spacing. */
export function pickLabelIndices(count: number, maxLabels: number): Set<number> {
  if (count <= maxLabels) return new Set(Array.from({ length: count }, (_, i) => i));
  const step = (count - 1) / (maxLabels - 1);
  const indices = new Set<number>();
  for (let i = 0; i < maxLabels; i++) indices.add(Math.round(i * step));
  return indices;
}

/**
 * Draws the full card at a given animation progress (0..1). Called on every
 * animation frame during the "generating" reveal, and once more at
 * progress=1 immediately before export, so the downloaded image is always
 * the crisp final frame regardless of when the user taps Download.
 */
export function drawExamTrendCard(
  ctx: CanvasRenderingContext2D,
  points: ExamTrendPoint[],
  rawProgress: number,
  logo?: HTMLImageElement | null
) {
  const p = clamp01(rawProgress);
  const stats = computeCardStats(points);

  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const pad = 64;

  // ---- Header: logo + wordmark ----
  const headerOpacity = clamp01(p / 0.12);
  const headerMidY = pad + 22;
  ctx.save();
  ctx.globalAlpha = headerOpacity;
  if (logo) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo, pad, headerMidY - LOGO_SIZE / 2, LOGO_SIZE, LOGO_SIZE);
  }
  const wordX = pad + LOGO_SIZE + LOGO_GAP;
  ctx.fillStyle = COLOR.ink;
  ctx.font = `600 34px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Tally', wordX, headerMidY);
  const tallyWidth = ctx.measureText('Tally').width;
  ctx.fillStyle = COLOR.accent;
  ctx.fillText('.', wordX + tallyWidth, headerMidY);
  ctx.restore();

  // ---- Title + subtitle ----
  const titleOpacity = clamp01((p - 0.03) / 0.12);
  ctx.save();
  ctx.globalAlpha = titleOpacity;
  ctx.fillStyle = COLOR.ink;
  ctx.font = `700 48px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Exam Score Trend', pad, 210);

  ctx.fillStyle = COLOR.inkMuted;
  ctx.font = `400 26px ${FONT_UI}`;
  const rangeLabel = `${formatDate(points[0].date)} – ${formatDate(points[points.length - 1].date)}`;
  ctx.fillText(rangeLabel, pad, 250);
  ctx.restore();

  // ---- Stat row ----
  const statsProgress = easeOutCubic(clamp01(p / 0.55));
  const statY = 330;
  const columns = [
    { label: 'LATEST', value: stats.latest, color: COLOR.accent },
    { label: 'HIGHEST', value: stats.highest, color: COLOR.success },
    { label: 'AVERAGE', value: stats.average, color: COLOR.ink }
  ];
  const colWidth = (CARD_WIDTH - pad * 2) / 3;
  ctx.save();
  ctx.globalAlpha = clamp01(p / 0.1);
  columns.forEach((col, i) => {
    const cx = pad + colWidth * i;
    const animatedValue = Math.round(col.value * statsProgress * 10) / 10;
    ctx.fillStyle = COLOR.inkFaint;
    ctx.font = `600 20px ${FONT_UI}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(col.label, cx, statY);
    ctx.fillStyle = col.color;
    ctx.font = `700 64px ${FONT_NUMERIC}`;
    ctx.fillText(`${animatedValue}%`, cx, statY + 66);
    if (i > 0) {
      ctx.strokeStyle = COLOR.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 28, statY - 28);
      ctx.lineTo(cx - 28, statY + 70);
      ctx.stroke();
    }
  });
  ctx.restore();

  // ---- Chart area ----
  const chartTop = 470;
  const chartBottom = CARD_HEIGHT - 190;
  const chartLeft = pad + 70;
  const chartRight = CARD_WIDTH - pad;
  const chartHeight = chartBottom - chartTop;
  const chartWidth = chartRight - chartLeft;

  const gridOpacity = clamp01((p - 0.05) / 0.15);
  ctx.save();
  ctx.globalAlpha = gridOpacity;
  ctx.strokeStyle = COLOR.border;
  ctx.fillStyle = COLOR.inkFaint;
  ctx.font = `500 20px ${FONT_UI}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  [0, 25, 50, 75, 100].forEach((tick) => {
    const y = chartBottom - (tick / 100) * chartHeight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
    ctx.fillText(`${tick}`, chartLeft - 14, y);
  });
  ctx.textAlign = 'left';

  // Y-axis label, rotated
  ctx.save();
  ctx.translate(pad - 34, chartTop + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = `600 22px ${FONT_UI}`;
  ctx.fillStyle = COLOR.inkMuted;
  ctx.fillText('Score (%)', 0, 0);
  ctx.restore();

  // X-axis label
  ctx.textAlign = 'center';
  ctx.font = `600 22px ${FONT_UI}`;
  ctx.fillStyle = COLOR.inkMuted;
  ctx.fillText('Exam date (chronological)', chartLeft + chartWidth / 2, chartBottom + 74);
  ctx.textAlign = 'left';
  ctx.restore();

  // ---- Line + area + points ----
  const n = points.length;
  const xFor = (i: number) => chartLeft + (i / (n - 1)) * chartWidth;
  const yFor = (pct: number) => chartBottom - (pct / 100) * chartHeight;

  const lineProgress = easeOutCubic(clamp01((p - 0.18) / 0.62));
  const visibleSpan = lineProgress * (n - 1);

  if (visibleSpan > 0) {
    // build the visible point list, interpolating a partial final segment
    const visiblePoints: { x: number; y: number }[] = [];
    for (let i = 0; i <= Math.floor(visibleSpan); i++) {
      visiblePoints.push({ x: xFor(i), y: yFor(points[i].percentage) });
    }
    const frac = visibleSpan - Math.floor(visibleSpan);
    if (frac > 0 && Math.floor(visibleSpan) + 1 < n) {
      const i0 = Math.floor(visibleSpan);
      const p0 = points[i0];
      const p1 = points[i0 + 1];
      visiblePoints.push({
        x: lerp(xFor(i0), xFor(i0 + 1), frac),
        y: lerp(yFor(p0.percentage), yFor(p1.percentage), frac)
      });
    }

    // area fill
    const gradient = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
    gradient.addColorStop(0, COLOR.accentSoft);
    gradient.addColorStop(1, 'rgba(230,238,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(visiblePoints[0].x, chartBottom);
    visiblePoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(visiblePoints[visiblePoints.length - 1].x, chartBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    // line
    ctx.save();
    ctx.strokeStyle = COLOR.accent;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    visiblePoints.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
    ctx.restore();

    // dots + value labels for fully-reached points
    points.forEach((pt, i) => {
      if (i > visibleSpan + 0.001) return;
      const dotProgress = clamp01((visibleSpan - i) * 5 + 1);
      const scale = dotProgress < 1 ? 0.7 + 0.3 * easeOutCubic(dotProgress) : 1;
      const x = xFor(i);
      const y = yFor(pt.percentage);
      ctx.save();
      ctx.globalAlpha = dotProgress;
      ctx.beginPath();
      ctx.arc(x, y, 9 * scale, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.white;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLOR.accent;
      ctx.stroke();
      ctx.restore();
    });
  }

  // x-axis tick labels
  ctx.save();
  ctx.globalAlpha = gridOpacity;
  ctx.fillStyle = COLOR.inkFaint;
  ctx.font = `500 19px ${FONT_UI}`;
  ctx.textAlign = 'center';
  const labelIndices = pickLabelIndices(n, 6);
  points.forEach((pt, i) => {
    if (!labelIndices.has(i)) return;
    ctx.fillText(pt.label, xFor(i), chartBottom + 32);
  });
  ctx.restore();

  // ---- Footer ----
  const footerOpacity = clamp01((p - 0.85) / 0.15);
  ctx.save();
  ctx.globalAlpha = footerOpacity;
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, CARD_HEIGHT - 90);
  ctx.lineTo(CARD_WIDTH - pad, CARD_HEIGHT - 90);
  ctx.stroke();

  ctx.fillStyle = COLOR.inkFaint;
  ctx.font = `500 20px ${FONT_UI}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Generated by Tally', pad, CARD_HEIGHT - 50);
  ctx.textAlign = 'right';
  ctx.fillText(formatDate(new Date().toISOString().slice(0, 10)), CARD_WIDTH - pad, CARD_HEIGHT - 50);
  ctx.restore();
}
