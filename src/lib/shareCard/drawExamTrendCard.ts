import type { ExamTrendPoint } from '@/lib/examTrend';
import { formatDate } from '@/lib/dates';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

// Brand tokens (kept as literal hex here rather than reading CSS variables,
// since canvas drawing happens outside the CSS cascade entirely).
const COLOR = {
  bg: '#F2F3F6',
  ink: '#0F1216',
  inkMuted: '#5A6374',
  inkFaint: '#96A0AD',
  accent: '#284EFE',
  accentSoft: '#E5EAFF',
  success: '#3EBD7E',
  border: '#E0E4EB',
  white: '#FFFFFF'
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Draws the Tally brand mark (3 bars + diagonal) at the given top-left position and size. */
function drawTallyMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, barColor: string) {
  // geometry matches design/icon-master.svg's inner group (local box ~320x290)
  const s = size / 290;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = barColor;
  const bars = [69, 135, 201];
  for (const bx of bars) {
    ctx.fillRect(bx * s, 50 * s, 38 * s, 205 * s);
  }
  ctx.strokeStyle = COLOR.accent;
  ctx.lineWidth = 34 * s;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(27 * s, 202 * s);
  ctx.lineTo(294 * s, 83 * s);
  ctx.stroke();
  ctx.restore();
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
  rawProgress: number
) {
  const p = clamp01(rawProgress);
  const stats = computeCardStats(points);

  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const pad = 64;

  // ---- Header: brand mark + wordmark ----
  const headerOpacity = clamp01(p / 0.12);
  ctx.save();
  ctx.globalAlpha = headerOpacity;
  drawTallyMark(ctx, pad, pad, 44, COLOR.ink);
  ctx.fillStyle = COLOR.ink;
  ctx.font = "600 34px 'Sora', system-ui, sans-serif";
  ctx.textBaseline = 'middle';
  ctx.fillText('Tally', pad + 62, pad + 22);
  const tallyWidth = ctx.measureText('Tally').width;
  ctx.fillStyle = COLOR.accent;
  ctx.fillText('.', pad + 62 + tallyWidth, pad + 22);
  ctx.restore();

  // ---- Title + subtitle ----
  const titleOpacity = clamp01((p - 0.03) / 0.12);
  ctx.save();
  ctx.globalAlpha = titleOpacity;
  ctx.fillStyle = COLOR.ink;
  ctx.font = "700 48px 'Sora', system-ui, sans-serif";
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Exam Score Trend', pad, 210);

  ctx.fillStyle = COLOR.inkMuted;
  ctx.font = "400 26px 'Plus Jakarta Sans', system-ui, sans-serif";
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
    ctx.font = "600 20px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(col.label, cx, statY);
    ctx.fillStyle = col.color;
    ctx.font = "700 64px 'Sora', system-ui, sans-serif";
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
  ctx.font = "500 20px 'Plus Jakarta Sans', system-ui, sans-serif";
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
  ctx.font = "600 22px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = COLOR.inkMuted;
  ctx.fillText('Score (%)', 0, 0);
  ctx.restore();

  // X-axis label
  ctx.textAlign = 'center';
  ctx.font = "600 22px 'Plus Jakarta Sans', system-ui, sans-serif";
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
    gradient.addColorStop(1, 'rgba(229,234,255,0)');
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
  ctx.font = "500 19px 'Plus Jakarta Sans', system-ui, sans-serif";
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
  ctx.font = "500 20px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Generated by Tally', pad, CARD_HEIGHT - 50);
  ctx.textAlign = 'right';
  ctx.fillText(formatDate(new Date().toISOString().slice(0, 10)), CARD_WIDTH - pad, CARD_HEIGHT - 50);
  ctx.restore();
}
