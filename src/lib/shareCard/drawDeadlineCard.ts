import { daysBetween, parseISODate, todayISO } from '@/lib/dates';
import { formatTime12 } from '@/lib/deadlineFormat';

/** 4:5 portrait, the same shape as the task card. */
export const DEADLINE_CARD_WIDTH = 1080;
export const DEADLINE_CARD_HEIGHT = 1350;

export type DeadlineCardTheme = 'paper' | 'ink';

interface Palette {
  bg: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  accent: string;
  done: string;
  danger: string;
  saffron: string;
  track: string;
}

// Literal colours: canvas drawing happens outside the CSS cascade.
const PALETTES: Record<DeadlineCardTheme, Palette> = {
  paper: {
    bg: '#F6F1E8',
    ink: '#1C1814',
    muted: '#686056',
    faint: '#92897D',
    border: '#DDD5C7',
    accent: '#D94F2D',
    done: '#2F7D5B',
    danger: '#A82038',
    saffron: '#C98B12',
    track: '#E6DFD0'
  },
  ink: {
    bg: '#0E0C0A',
    ink: '#F5EEE3',
    muted: '#B3A99A',
    faint: '#7A7165',
    border: '#2A2622',
    accent: '#FF7A54',
    done: '#5FC092',
    danger: '#FF6B7D',
    saffron: '#F2B84B',
    track: '#2A2622'
  }
};

// Latin fonts first; anything in Bengali falls through to Tiro Bangla.
const FONT_SERIF = "'Instrument Serif', 'Tiro Bangla', Georgia, serif";
const FONT_UI = "'Plus Jakarta Sans', 'Tiro Bangla', system-ui, sans-serif";
const FONT_NUMERIC = "'Space Grotesk', 'Tiro Bangla', system-ui, sans-serif";

export interface DeadlineCardData {
  title: string;
  /** yyyy-mm-dd */
  dueISO: string;
  /** HH:MM */
  dueTime?: string;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  notes?: string;
  status: 'open' | 'done';
  /** The day the deadline was added, yyyy-mm-dd. */
  createdISO: string;
  /** First name, shown at the top right. */
  name?: string;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function put(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'left',
  baseline: CanvasTextBaseline = 'alphabetic'
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

function measure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Shortens text with an ellipsis until it fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}\u2026`).width > maxWidth) t = t.slice(0, -1);
  return `${t}\u2026`;
}

/** Wraps text onto at most `maxLines` lines; the last line gets an ellipsis if text is left over. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
  maxLines: number
): string[] {
  ctx.font = font;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) {
      lines.push(line);
      line = '';
    }
    // a single word wider than the card is broken up
    let rest = word;
    while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
      let cut = rest.length;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(ctx, lines.slice(maxLines - 1).join(' '), font, maxWidth);
  return kept;
}

function hline(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color: string,
  width: number
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draws the whole deadline card. `rawProgress` (0 to 1) drives the reveal: the
 * big number counts up, the timeline fills and the details appear one after
 * another. It is called every frame while revealing, and once with 1 right
 * before saving, so the saved image is always the finished card.
 *
 * The card reads at a glance: how much time is left (or that it is today,
 * overdue, or done), a bar from the day it was added to the day it is due,
 * the priority, the title, and any notes.
 */
export function drawDeadlineCard(
  ctx: CanvasRenderingContext2D,
  data: DeadlineCardData,
  theme: DeadlineCardTheme,
  logo: HTMLImageElement | null | undefined,
  rawProgress: number
): void {
  const P = PALETTES[theme];
  const p = clamp01(rawProgress);
  const W = DEADLINE_CARD_WIDTH;
  const H = DEADLINE_CARD_HEIGHT;
  const PAD = 76;

  const today = todayISO();
  const diff = daysBetween(today, data.dueISO);
  const done = data.status === 'done';
  const overdue = !done && diff < 0;
  const isToday = !done && diff === 0;
  const stateColor = done ? P.done : overdue ? P.danger : P.accent;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  // ---- header: logo, wordmark, due date ----
  ctx.save();
  ctx.globalAlpha = ease(clamp01(p / 0.15));
  if (logo) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo, PAD, PAD, 56, 56);
  }
  const midY = PAD + 28;
  const wordX = PAD + 56 + 18;
  const wordFont = `400 46px ${FONT_SERIF}`;
  put(ctx, 'Tally', wordX, midY, wordFont, P.ink, 'left', 'middle');
  const wordW = measure(ctx, 'Tally', wordFont);
  put(ctx, '.', wordX + wordW, midY, wordFont, P.accent, 'left', 'middle');
  const dueText = parseISODate(data.dueISO)
    .toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();
  put(ctx, dueText, W - PAD, midY, `600 22px ${FONT_UI}`, P.faint, 'right', 'middle');
  ctx.restore();

  // ---- small label above the number, and the name ----
  const eyebrow = done ? 'COMPLETED' : overdue ? 'OVERDUE BY' : isToday ? 'DUE' : 'TIME LEFT';
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.04) / 0.2));
  put(ctx, eyebrow, PAD, 262, `600 24px ${FONT_UI}`, P.faint);
  const who = data.name?.trim();
  if (who) put(ctx, fit(ctx, who.toUpperCase(), `600 24px ${FONT_UI}`, 420), W - PAD, 262, `600 24px ${FONT_UI}`, P.faint, 'right');
  ctx.restore();

  // ---- the big number (or word) ----
  const baseY = 540;
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.06) / 0.2));
  if (done || isToday) {
    put(ctx, done ? 'Done' : 'Today', PAD, baseY, `400 290px ${FONT_SERIF}`, stateColor);
  } else {
    const n = Math.abs(diff);
    const count = ease(clamp01((p - 0.08) / 0.5));
    const shown = String(Math.round(n * count));
    const numFont = `400 330px ${FONT_SERIF}`;
    put(ctx, shown, PAD, baseY, numFont, stateColor);
    const numW = measure(ctx, shown, numFont);
    const unit = overdue ? (n === 1 ? 'day overdue' : 'days overdue') : n === 1 ? 'day to go' : 'days to go';
    put(ctx, unit, PAD + numW + 28, baseY, `italic 400 70px ${FONT_SERIF}`, P.muted);
  }
  ctx.restore();

  // ---- timeline: from the day it was added to the day it is due ----
  const barY = 600;
  const barW = W - PAD * 2;
  const total = Math.max(1, daysBetween(data.createdISO, data.dueISO));
  const elapsed = daysBetween(data.createdISO, today);
  const frac = done || overdue ? 1 : clamp01(elapsed / total);
  const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.2) / 0.2));
  pill(ctx, PAD, barY, barW, 14, P.track);
  const fillW = barW * frac * ease(clamp01((p - 0.25) / 0.45));
  if (fillW > 0) pill(ctx, PAD, barY, Math.max(14, fillW), 14, stateColor);
  put(
    ctx,
    `ADDED ${parseISODate(data.createdISO).toLocaleDateString('en-US', short).toUpperCase()}`,
    PAD,
    barY + 56,
    `600 22px ${FONT_UI}`,
    P.faint
  );
  put(
    ctx,
    `DUE ${parseISODate(data.dueISO).toLocaleDateString('en-US', short).toUpperCase()}`,
    W - PAD,
    barY + 56,
    `600 22px ${FONT_UI}`,
    P.faint,
    'right'
  );
  ctx.restore();

  // ---- priority, category and time ----
  const rowY = 770;
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.38) / 0.2));
  hline(ctx, PAD, W - PAD, 712, P.border, 2);
  const dotColor = data.priority === 'high' ? P.danger : data.priority === 'medium' ? P.saffron : P.done;
  ctx.beginPath();
  ctx.arc(PAD + 9, rowY, 9, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();
  const prioFont = `600 24px ${FONT_UI}`;
  const prioLabel = `${data.priority.toUpperCase()} PRIORITY`;
  put(ctx, prioLabel, PAD + 28, rowY, prioFont, P.ink, 'left', 'middle');
  let x = PAD + 28 + measure(ctx, prioLabel, prioFont);
  const timeText = formatTime12(data.dueTime);
  const timeW = timeText ? measure(ctx, timeText, `700 34px ${FONT_NUMERIC}`) + 24 : 0;
  const category = data.category?.trim();
  if (category) {
    const catFont = `500 24px ${FONT_UI}`;
    const room = W - PAD - timeW - x - 40;
    if (room > 80) {
      const label = fit(ctx, category, catFont, room);
      x += 22;
      put(ctx, '\u00B7', x, rowY, catFont, P.faint, 'left', 'middle');
      put(ctx, label, x + 22, rowY, catFont, P.muted, 'left', 'middle');
    }
  }
  if (timeText) put(ctx, timeText, W - PAD, rowY, `700 34px ${FONT_NUMERIC}`, P.ink, 'right', 'middle');
  ctx.restore();

  // ---- title ----
  const titleFont = `400 88px ${FONT_SERIF}`;
  const titleLines = wrapLines(ctx, data.title, titleFont, W - PAD * 2, 3);
  const lineH = 100;
  const titleTop = 890;
  const a = ease(clamp01((p - 0.45) / 0.3));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - a) * 16);
  titleLines.forEach((line, i) => {
    put(ctx, line, PAD, titleTop + i * lineH, titleFont, done ? P.muted : P.ink);
  });
  ctx.restore();

  // ---- notes, as many lines as fit above the footer ----
  const notes = data.notes?.trim();
  if (notes) {
    const lastTitleY = titleTop + (titleLines.length - 1) * lineH;
    const notesY = lastTitleY + 84;
    const lineGap = 54;
    const maxNotes = notesY <= 1200 ? Math.min(2, Math.floor((1200 - notesY) / lineGap) + 1) : 0;
    if (maxNotes > 0) {
      const notesFont = `italic 400 40px ${FONT_SERIF}`;
      const noteLines = wrapLines(ctx, notes.replace(/\s+/g, ' '), notesFont, W - PAD * 2, maxNotes);
      ctx.save();
      ctx.globalAlpha = ease(clamp01((p - 0.6) / 0.25));
      noteLines.forEach((line, i) => put(ctx, line, PAD, notesY + i * lineGap, notesFont, P.muted));
      ctx.restore();
    }
  }

  // ---- footer ----
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.8) / 0.2));
  hline(ctx, PAD, W - PAD, H - 120, P.border, 2);
  put(ctx, 'Tracked with Tally', PAD, H - 72, `500 24px ${FONT_UI}`, P.faint, 'left', 'middle');
  const madeOn = parseISODate(today).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  put(ctx, madeOn, W - PAD, H - 72, `500 24px ${FONT_NUMERIC}`, P.faint, 'right', 'middle');
  ctx.restore();
}
