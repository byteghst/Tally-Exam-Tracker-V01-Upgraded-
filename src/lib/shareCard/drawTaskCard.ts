import type { Task } from '@/types';
import { parseISODate } from '@/lib/dates';
import { subtaskProgress } from '@/lib/subtasks';

/** 4:5 portrait: the shape that fills the most space in a Threads or Instagram feed. */
export const TASK_CARD_WIDTH = 1080;
export const TASK_CARD_HEIGHT = 1350;

export type TaskCardTheme = 'paper' | 'ink';

interface Palette {
  bg: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  accent: string;
  done: string;
  onDone: string;
  track: string;
}

// Literal colours: canvas drawing happens outside the CSS cascade.
const PALETTES: Record<TaskCardTheme, Palette> = {
  paper: {
    bg: '#F6F1E8',
    ink: '#1C1814',
    muted: '#686056',
    faint: '#92897D',
    border: '#DDD5C7',
    accent: '#D94F2D',
    done: '#2F7D5B',
    onDone: '#FBF8F2',
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
    onDone: '#0E0C0A',
    track: '#2A2622'
  }
};

// Latin fonts first; the Latin fonts have no Bengali letters, so anything in
// Bengali is drawn in Tiro Bangla.
const FONT_SERIF = "'Instrument Serif', 'Tiro Bangla', Georgia, serif";
const FONT_UI = "'Plus Jakarta Sans', 'Tiro Bangla', system-ui, sans-serif";
const FONT_NUMERIC = "'Space Grotesk', 'Tiro Bangla', system-ui, sans-serif";

/** One day of the weekly card. */
export interface TaskCardDay {
  iso: string;
  done: number;
  total: number;
}

export interface TaskCardData {
  /** 'day' lists the tasks of one day; 'week' summarises the last seven days. */
  kind: 'day' | 'week';
  /** The day shown (kind 'day') or the first day of the week (kind 'week'), yyyy-mm-dd. */
  dateISO: string;
  /** The last day shown, yyyy-mm-dd (the same as dateISO for a single day). */
  endISO: string;
  /** For a single day: 'Today' or 'Yesterday'. */
  dayLabel?: string;
  /** First name, shown as "Name's day". */
  name?: string;
  /** The tasks in the range shown. */
  tasks: Task[];
  /** Study time logged in the range, in milliseconds. */
  studyMs: number;
  /** Days in a row with progress, ending on the last day shown. */
  streak: number;
  /** Per-day totals, for the weekly card. */
  days?: TaskCardDay[];
}

// A handful of Bengali letters and digits, so the Bengali part of Tiro Bangla
// (fetched only when Bengali text is used) is always loaded before drawing.
const BENGALI_SAMPLE = 'অআইঈউঊএঐওঔকখগঘচছজঝটঠডঢণতথদধনপফবভমযরলশষসহ০১২৩৪৫৬৭৮৯ািীুূেৈোৌ';

/** Every piece of text the card can draw, used to make sure the right font files are loaded. */
export function taskCardSampleText(names: string[], userName?: string): string {
  return [userName ?? '', ...names, BENGALI_SAMPLE, 'Today Tally 0123456789'].join(' ');
}

/**
 * Canvas text does not load web fonts by itself, so the fonts are loaded
 * explicitly before the first frame.
 */
export async function prepareTaskCardFonts(sample: string): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    const specs = [
      `400 120px ${FONT_SERIF}`,
      `italic 400 40px ${FONT_SERIF}`,
      `600 22px ${FONT_UI}`,
      `500 34px ${FONT_UI}`,
      `600 28px ${FONT_NUMERIC}`,
      `700 40px ${FONT_NUMERIC}`,
      `400 34px 'Tiro Bangla'`,
      `italic 400 34px 'Tiro Bangla'`
    ];
    await Promise.all(specs.map((spec) => document.fonts.load(spec, sample)));
    await document.fonts.ready;
  } catch {
    // draw with whatever is loaded: a fallback font beats no card
  }
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
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

/** Shortens text with an ellipsis until it fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function hline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
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

function formatStudy(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return '<1m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function headline(done: number, total: number): string {
  if (total === 0) return 'A clear day.';
  if (done === total) return 'Every single task, done.';
  if (done * 2 >= total) return 'More than halfway there.';
  if (done > 0) return 'Moving, one task at a time.';
  return 'The day is just beginning.';
}

/**
 * Draws the whole card. `rawProgress` (0 to 1) drives the reveal: the big
 * number counts up, the bar fills and the rows (or the week's bars) appear one
 * after another. It is called every frame while revealing, and once with 1
 * right before saving, so the saved image is always the finished card.
 */
export function drawTaskCard(
  ctx: CanvasRenderingContext2D,
  data: TaskCardData,
  theme: TaskCardTheme,
  logo: HTMLImageElement | null | undefined,
  rawProgress: number
): void {
  const P = PALETTES[theme];
  const p = clamp01(rawProgress);
  const W = TASK_CARD_WIDTH;
  const H = TASK_CARD_HEIGHT;
  const PAD = 76;
  const isWeek = data.kind === 'week';

  // completed tasks first, so the card leads with what got done
  const ordered = [...data.tasks].sort(
    (a, b) => Number(b.status === 'completed') - Number(a.status === 'completed')
  );
  const total = ordered.length;
  const done = ordered.filter((t) => t.status === 'completed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const startDate = parseISODate(data.dateISO);
  const endDate = parseISODate(data.endISO);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  // ---- header: logo, wordmark, date ----
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
  ctx.font = wordFont;
  const wordW = ctx.measureText('Tally').width;
  put(ctx, '.', wordX + wordW, midY, wordFont, P.accent, 'left', 'middle');
  const shortFmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const dateText = isWeek
    ? `${startDate.toLocaleDateString('en-US', shortFmt)} – ${endDate.toLocaleDateString('en-US', shortFmt)}`.toUpperCase()
    : startDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  put(ctx, dateText, W - PAD, midY, `600 22px ${FONT_UI}`, P.faint, 'right', 'middle');
  ctx.restore();

  // ---- title and one-line summary ----
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.04) / 0.2));
  const name = data.name?.trim();
  const dayLabel = data.dayLabel ?? 'Today';
  let title: string;
  if (isWeek) title = name ? `${name}'s week` : 'This week';
  else if (dayLabel === 'Today') title = name ? `${name}'s day` : 'Today';
  else title = name ? `${name}, ${dayLabel.toLowerCase()}` : dayLabel;
  const titleFont = `400 120px ${FONT_SERIF}`;
  put(ctx, fit(ctx, title, titleFont, W - PAD * 2), PAD, 285, titleFont, P.ink);
  const sub = isWeek && total > 0 && done === total ? 'A perfect week.' : headline(done, total);
  put(ctx, sub, PAD, 342, `italic 400 40px ${FONT_SERIF}`, P.muted);
  ctx.restore();

  // ---- streak and study time, to the right of the big number ----
  const stats: Array<{ label: string; value: string; color: string }> = [];
  if (data.streak > 0) {
    stats.push({ label: 'STREAK', value: `${data.streak} ${data.streak === 1 ? 'day' : 'days'}`, color: P.accent });
  }
  if (data.studyMs > 0) {
    const label = isWeek ? 'STUDY THIS WEEK' : dayLabel === 'Today' ? 'STUDY TODAY' : 'STUDY';
    stats.push({ label, value: formatStudy(data.studyMs), color: P.ink });
  }
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.2) / 0.3));
  stats.forEach((s, i) => {
    const labelY = 412 + i * 104;
    put(ctx, s.label, W - PAD, labelY, `600 22px ${FONT_UI}`, P.faint, 'right');
    put(ctx, s.value, W - PAD, labelY + 50, `700 46px ${FONT_NUMERIC}`, s.color, 'right');
  });
  ctx.restore();

  if (total === 0) {
    ctx.save();
    ctx.globalAlpha = ease(clamp01((p - 0.2) / 0.3));
    put(ctx, isWeek ? 'No tasks this week.' : 'Nothing planned.', PAD, 560, `400 84px ${FONT_SERIF}`, P.ink);
    ctx.restore();
  } else {
    // ---- big count and progress bar ----
    const stat = ease(clamp01((p - 0.1) / 0.5));
    const shown = Math.round(done * stat);
    const numFont = `400 210px ${FONT_SERIF}`;
    put(ctx, String(shown), PAD, 570, numFont, P.ink);
    ctx.font = numFont;
    const numW = ctx.measureText(String(shown)).width;
    put(ctx, `/${total}`, PAD + numW + 10, 570, `400 110px ${FONT_SERIF}`, P.faint);

    put(ctx, isWeek ? 'TASKS DONE THIS WEEK' : 'TASKS DONE', PAD, 622, `600 22px ${FONT_UI}`, P.faint);
    put(ctx, `${Math.round(pct * stat)}%`, W - PAD, 622, `700 40px ${FONT_NUMERIC}`, P.accent, 'right');

    const barW = W - PAD * 2;
    pill(ctx, PAD, 648, barW, 14, P.track);
    const fill = barW * (pct / 100) * stat;
    if (fill > 0) pill(ctx, PAD, 648, Math.max(14, fill), 14, P.accent);
  }

  const listTop = 716;

  if (isWeek) {
    // ---- the week, one bar per day ----
    const days = data.days ?? [];
    ctx.save();
    ctx.globalAlpha = ease(clamp01((p - 0.25) / 0.2));
    hline(ctx, PAD, W - PAD, listTop, P.border, 2);
    put(ctx, 'DAY BY DAY', PAD, listTop + 46, `600 22px ${FONT_UI}`, P.faint);
    ctx.restore();

    const baseY = 1130;
    const maxH = 260;
    const maxTotal = Math.max(1, ...days.map((d) => d.total));
    const colW = (W - PAD * 2) / 7;
    const barW = 60;

    days.forEach((d, i) => {
      const grow = ease(clamp01((p - 0.3 - i * 0.06) / 0.35));
      const cx = PAD + colW * i + colW / 2;
      const totalH = (d.total / maxTotal) * maxH * grow;
      const doneH = (d.done / maxTotal) * maxH * grow;

      if (d.total > 0) {
        pill(ctx, cx - barW / 2, baseY - Math.max(8, totalH), barW, Math.max(8, totalH), P.track);
        if (d.done > 0) {
          pill(
            ctx,
            cx - barW / 2,
            baseY - Math.max(8, doneH),
            barW,
            Math.max(8, doneH),
            d.done === d.total ? P.done : P.accent
          );
        }
        put(ctx, `${d.done}/${d.total}`, cx, baseY - Math.max(8, totalH) - 16, `600 24px ${FONT_NUMERIC}`, P.muted, 'center');
      } else {
        pill(ctx, cx - barW / 2, baseY - 8, barW, 8, P.track);
      }

      const letter = parseISODate(d.iso).toLocaleDateString('en-US', { weekday: 'narrow' });
      put(ctx, letter, cx, baseY + 44, `600 26px ${FONT_UI}`, d.iso === data.endISO ? P.ink : P.faint, 'center');
    });
  } else if (total > 0) {
    // ---- the tasks of the day ----
    const rowH = 82;
    const maxRows = 5;
    const visible = ordered.length > maxRows ? ordered.slice(0, maxRows - 1) : ordered;
    const hidden = ordered.length - visible.length;

    visible.forEach((task, i) => {
      const y = listTop + i * rowH;
      const a = ease(clamp01((p - 0.3 - i * 0.07) / 0.25));
      const cy = y + rowH / 2;
      const cx = PAD + 20;
      const isDone = task.status === 'completed';
      const subProgress = subtaskProgress(task);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, (1 - a) * 14);

      hline(ctx, PAD, W - PAD, y, P.border, 2);

      // tick circle
      ctx.beginPath();
      ctx.arc(cx, cy, 19, 0, Math.PI * 2);
      if (isDone) {
        ctx.fillStyle = P.done;
        ctx.fill();
        ctx.strokeStyle = P.onDone;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy + 1);
        ctx.lineTo(cx - 2, cy + 8);
        ctx.lineTo(cx + 9, cy - 7);
        ctx.stroke();
      } else {
        ctx.strokeStyle = P.faint;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // name, struck through when done
      const nameFont = `500 34px ${FONT_UI}`;
      const nameX = PAD + 60;
      const rightW = subProgress ? 120 : 0;
      const label = fit(ctx, task.name, nameFont, W - PAD - nameX - rightW - 12);
      put(ctx, label, nameX, cy, nameFont, isDone ? P.faint : P.ink, 'left', 'middle');
      if (isDone) {
        ctx.font = nameFont;
        const textW = ctx.measureText(label).width;
        hline(ctx, nameX, nameX + textW, cy, P.faint, 2.5);
      }

      // subtask count, e.g. 2/4
      if (subProgress) {
        put(
          ctx,
          `${subProgress.done}/${subProgress.total}`,
          W - PAD,
          cy,
          `600 28px ${FONT_NUMERIC}`,
          subProgress.done === subProgress.total ? P.done : P.muted,
          'right',
          'middle'
        );
      }

      ctx.restore();
    });

    if (hidden > 0) {
      const y = listTop + visible.length * rowH;
      ctx.save();
      ctx.globalAlpha = ease(clamp01((p - 0.3 - visible.length * 0.07) / 0.25));
      hline(ctx, PAD, W - PAD, y, P.border, 2);
      put(ctx, `+${hidden} more`, PAD + 60, y + rowH / 2, `italic 400 38px ${FONT_SERIF}`, P.muted, 'left', 'middle');
      ctx.restore();
    }
  }

  // ---- footer ----
  ctx.save();
  ctx.globalAlpha = ease(clamp01((p - 0.8) / 0.2));
  hline(ctx, PAD, W - PAD, H - 120, P.border, 2);
  put(ctx, 'Tracked with Tally', PAD, H - 72, `500 24px ${FONT_UI}`, P.faint, 'left', 'middle');
  const shortDate = endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  put(ctx, shortDate, W - PAD, H - 72, `500 24px ${FONT_NUMERIC}`, P.faint, 'right', 'middle');
  ctx.restore();
}
