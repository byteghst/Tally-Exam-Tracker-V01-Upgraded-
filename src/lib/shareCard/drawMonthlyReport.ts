import type { MonthlyReport } from '@/lib/monthlyReport';
import type { ExamType, TaskPriority } from '@/types';

export const REPORT_WIDTH = 1080;

const PAD = 64;
/** padding inside each white panel */
const INNER = 28;
const CONTENT_W = REPORT_WIDTH - PAD * 2;
const INNER_L = PAD + INNER;
const INNER_R = PAD + CONTENT_W - INNER;

// Brand tokens as literal hex: canvas drawing happens outside the CSS cascade.
// accent = the logo's blue.
const COLOR = {
  bg: '#F2F3F6',
  panel: '#FFFFFF',
  ink: '#0F1216',
  inkMuted: '#5A6374',
  inkFaint: '#96A0AD',
  accent: '#0055FE',
  accentSoft: '#E6EEFF',
  success: '#3EBD7E',
  warning: '#E0A93E',
  danger: '#E0645E',
  border: '#E0E4EB',
  track: '#EBEEF4'
};

// Same font roles as the app (bundled via @fontsource; loaded by prepareCardAssets()).
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_NUMERIC = "'Space Grotesk', system-ui, sans-serif";
const FONT_UI = "'Plus Jakarta Sans', system-ui, sans-serif";

const TYPE_LABEL: Record<ExamType, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };
const PRIORITY_COLOR: Record<TaskPriority, string> = { high: COLOR.danger, medium: COLOR.warning, low: COLOR.success };

const MAX_TABLE_ROWS = 12;
const MAX_SUBJECT_ROWS = 6;

type Ctx = CanvasRenderingContext2D;
type Align = 'left' | 'right' | 'center';

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function put(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: Align = 'left',
  baseline: CanvasTextBaseline = 'alphabetic'
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

function fit(ctx: Ctx, text: string, font: string, maxWidth: number): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number) {
  roundRectPath(ctx, x, y, w, h, 28);
  ctx.fillStyle = COLOR.panel;
  ctx.fill();
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function bar(ctx: Ctx, x: number, y: number, w: number, h: number, fraction: number, color: string) {
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = COLOR.track;
  ctx.fill();
  const f = Math.max(0, Math.min(1, fraction));
  if (f > 0) {
    roundRectPath(ctx, x, y, Math.max(h, w * f), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function duration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return ms > 0 ? '<1m' : '0m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function num(n: number): string {
  return String(Number(n.toFixed(2)));
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function scoreColor(pct: number): string {
  if (pct >= 75) return COLOR.success;
  if (pct >= 50) return COLOR.ink;
  return COLOR.danger;
}

// ---------------------------------------------------------------------------
// sections — each takes the current y and returns the y below itself
// ---------------------------------------------------------------------------

function drawHeader(ctx: Ctx, r: MonthlyReport, logo: HTMLImageElement | null | undefined): number {
  const midY = PAD + 22;
  if (logo) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo, PAD, midY - 28, 56, 56);
  }
  const wordX = PAD + 56 + 18;
  put(ctx, 'Tally', wordX, midY, `600 34px ${FONT_DISPLAY}`, COLOR.ink, 'left', 'middle');
  ctx.font = `600 34px ${FONT_DISPLAY}`;
  const tallyW = ctx.measureText('Tally').width;
  put(ctx, '.', wordX + tallyW, midY, `600 34px ${FONT_DISPLAY}`, COLOR.accent, 'left', 'middle');

  put(ctx, 'Monthly Report', PAD, 210, `700 56px ${FONT_DISPLAY}`, COLOR.ink);
  put(ctx, r.label, PAD, 258, `400 30px ${FONT_UI}`, COLOR.inkMuted);
  return 306;
}

function kpi(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueColor: string,
  sub: string,
  subColor: string,
  suffix?: string
) {
  panel(ctx, x, y, w, h);
  put(ctx, label, x + INNER, y + 46, `600 19px ${FONT_UI}`, COLOR.inkFaint);
  const valueFont = `700 58px ${FONT_NUMERIC}`;
  put(ctx, value, x + INNER, y + 112, valueFont, valueColor);
  if (suffix) {
    ctx.font = valueFont;
    const vw = ctx.measureText(value).width;
    put(ctx, suffix, x + INNER + vw + 10, y + 112, `600 28px ${FONT_NUMERIC}`, COLOR.inkFaint);
  }
  put(ctx, fit(ctx, sub, `500 21px ${FONT_UI}`, w - INNER * 2), x + INNER, y + 148, `500 21px ${FONT_UI}`, subColor);
}

function drawKpis(ctx: Ctx, r: MonthlyReport, y: number): number {
  const gap = 24;
  const w = (CONTENT_W - gap) / 2;
  const h = 170;
  const e = r.exams;
  const t = r.tasks;
  const s = r.study;

  const changeText =
    e.change === null
      ? e.average === null
        ? ''
        : `No earlier month to compare`
      : e.change === 0
        ? `Same as ${r.prevLabel}`
        : `${e.change > 0 ? '▲' : '▼'} ${num(Math.abs(e.change))} pts vs ${r.prevLabel}`;
  const changeColor = e.change === null || e.change === 0 ? COLOR.inkMuted : e.change > 0 ? COLOR.success : COLOR.danger;

  const studyDelta = s.totalMs - s.previousTotalMs;
  const studySub =
    s.sessions === 0
      ? 'No study time logged'
      : s.previousTotalMs > 0
        ? `${s.sessions} session${s.sessions === 1 ? '' : 's'} · ${studyDelta >= 0 ? '+' : '-'}${duration(Math.abs(studyDelta))} vs ${r.prevLabel}`
        : `${s.sessions} session${s.sessions === 1 ? '' : 's'}`;

  const cells = [
    {
      label: 'EXAMS SCORED',
      value: String(e.count),
      color: COLOR.ink,
      sub: e.unscored > 0 ? `${e.unscored} without a result` : e.count === 0 ? 'No results yet' : 'All results recorded',
      subColor: COLOR.inkMuted
    },
    {
      label: 'AVERAGE SCORE',
      value: e.average === null ? '—' : `${num(e.average)}%`,
      color: COLOR.accent,
      sub: changeText || 'No scored exams',
      subColor: changeText ? changeColor : COLOR.inkMuted
    },
    {
      label: 'BEST SCORE',
      value: e.best ? `${num(e.best.percentage)}%` : '—',
      color: COLOR.success,
      sub: e.best ? e.best.name : 'No scored exams',
      subColor: COLOR.inkMuted
    },
    {
      label: 'TASKS DONE',
      value: t.total === 0 ? '—' : `${t.completed}/${t.total}`,
      color: COLOR.ink,
      sub: t.rate === null ? 'No tasks this month' : `${t.rate}% completed`,
      subColor: COLOR.inkMuted
    },
    {
      label: 'STUDY TIME',
      value: s.totalMs === 0 ? '—' : duration(s.totalMs),
      color: COLOR.accent,
      sub: studySub,
      subColor: COLOR.inkMuted
    },
    {
      label: 'ACTIVE STUDY DAYS',
      value: String(s.activeDays),
      color: COLOR.ink,
      sub: s.avgPerActiveDayMs === null ? 'No study time logged' : `Avg ${duration(s.avgPerActiveDayMs)} on those days`,
      subColor: COLOR.inkMuted,
      suffix: `/ ${r.daysInMonth}`
    }
  ];

  cells.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    kpi(ctx, PAD + col * (w + gap), y + row * (h + gap), w, h, c.label, c.value, c.color, c.sub, c.subColor, c.suffix);
  });
  return y + 3 * h + 2 * gap;
}

/** Draws a section heading and returns the y where its panel starts. */
function sectionTitle(ctx: Ctx, text: string, y: number): number {
  put(ctx, text, PAD, y + 40, `600 40px ${FONT_DISPLAY}`, COLOR.ink);
  return y + 40 + 28;
}

function emptyPanel(ctx: Ctx, y: number, message: string): number {
  const h = 130;
  panel(ctx, PAD, y, CONTENT_W, h);
  put(ctx, message, PAD + INNER, y + h / 2, `500 26px ${FONT_UI}`, COLOR.inkMuted, 'left', 'middle');
  return y + h;
}

// ---- Exam performance ----

function drawExamSection(ctx: Ctx, r: MonthlyReport, startY: number): number {
  const y = sectionTitle(ctx, 'Exam performance', startY);
  const e = r.exams;
  if (e.count === 0) {
    return emptyPanel(ctx, y, e.unscored > 0 ? `${e.unscored} exam${e.unscored === 1 ? '' : 's'} this month, no results recorded yet.` : `No exams in ${r.label}.`);
  }

  const chartH = 330;
  // type chips flow onto a new row when they don't fit side by side
  const chipFont = `600 20px ${FONT_UI}`;
  ctx.font = chipFont;
  let chipRow = 0;
  let chipCursor = 0;
  const chips = e.byType.map((g) => {
    const text = `${TYPE_LABEL[g.type]} · ${g.count} exam${g.count === 1 ? '' : 's'} · avg ${num(g.average)}%`;
    const w = ctx.measureText(text).width + 36;
    if (chipCursor > 0 && INNER_L + chipCursor + w > INNER_R) {
      chipRow += 1;
      chipCursor = 0;
    }
    const placed = { text, w, x: INNER_L + chipCursor, row: chipRow };
    chipCursor += w + 12;
    return placed;
  });
  const chipsH = chips.length > 0 ? (chipRow + 1) * 62 + 22 : 0;
  const shown = e.items.slice(0, MAX_TABLE_ROWS);
  const moreCount = e.items.length - shown.length;
  const tableH = 56 + shown.length * 62 + (moreCount > 0 ? 50 : 0);
  const panelH = INNER + chartH + chipsH + tableH + INNER;
  panel(ctx, PAD, y, CONTENT_W, panelH);

  // -- chart --
  const cx0 = INNER_L + 56;
  const cw = INNER_R - cx0;
  const cy0 = y + INNER + 36;
  const ch = chartH - 36 - 70;

  ctx.textBaseline = 'middle';
  for (const tick of [0, 25, 50, 75, 100]) {
    const yy = cy0 + ch - (tick / 100) * ch;
    ctx.strokeStyle = COLOR.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx0, yy);
    ctx.lineTo(INNER_R, yy);
    ctx.stroke();
    put(ctx, String(tick), cx0 - 14, yy, `500 19px ${FONT_UI}`, COLOR.inkFaint, 'right', 'middle');
  }

  const pts = e.items.map((it) => {
    const day = Number(it.date.slice(8, 10));
    return {
      day,
      pct: it.percentage,
      x: cx0 + 22 + ((day - 1) / (r.daysInMonth - 1)) * (cw - 44),
      y: cy0 + ch - (it.percentage / 100) * ch
    };
  });

  if (pts.length >= 2) {
    const grad = ctx.createLinearGradient(0, cy0, 0, cy0 + ch);
    grad.addColorStop(0, COLOR.accentSoft);
    grad.addColorStop(1, 'rgba(230,238,255,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, cy0 + ch);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, cy0 + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = COLOR.accent;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  let lastLabelX = -1000;
  pts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.panel;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOR.accent;
    ctx.stroke();
    if (pts.length <= 8) put(ctx, `${num(p.pct)}%`, p.x, p.y - 20, `700 20px ${FONT_NUMERIC}`, COLOR.ink, 'center');
    if (p.x - lastLabelX >= 30) {
      put(ctx, String(p.day), p.x, cy0 + ch + 32, `500 19px ${FONT_UI}`, COLOR.inkFaint, 'center');
      lastLabelX = p.x;
    }
  });
  put(ctx, 'Day of month', cx0 + cw / 2, cy0 + ch + 62, `600 20px ${FONT_UI}`, COLOR.inkMuted, 'center');

  let ty = y + INNER + chartH;

  // -- by type chips --
  if (chips.length > 0) {
    for (const c of chips) {
      const cyTop = ty + 6 + c.row * 62;
      roundRectPath(ctx, c.x, cyTop, c.w, 50, 25);
      ctx.fillStyle = COLOR.accentSoft;
      ctx.fill();
      put(ctx, c.text, c.x + 18, cyTop + 25, chipFont, COLOR.accent, 'left', 'middle');
    }
    ty += chipsH;
  }

  // -- table --
  const nameX = INNER_L + 120;
  const scoreR = INNER_R - 116;
  const hdr = `600 17px ${FONT_UI}`;
  put(ctx, 'DATE', INNER_L, ty + 30, hdr, COLOR.inkFaint);
  put(ctx, 'EXAM', nameX, ty + 30, hdr, COLOR.inkFaint);
  put(ctx, 'SCORE', scoreR, ty + 30, hdr, COLOR.inkFaint, 'right');
  put(ctx, '%', INNER_R, ty + 30, hdr, COLOR.inkFaint, 'right');
  let ry = ty + 56;
  shown.forEach((it) => {
    ctx.strokeStyle = COLOR.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(INNER_L, ry);
    ctx.lineTo(INNER_R, ry);
    ctx.stroke();
    const mid = ry + 31;
    put(ctx, shortDate(it.date), INNER_L, mid, `500 22px ${FONT_UI}`, COLOR.inkMuted, 'left', 'middle');
    put(ctx, fit(ctx, it.name, `600 23px ${FONT_UI}`, scoreR - 160 - nameX), nameX, mid, `600 23px ${FONT_UI}`, COLOR.ink, 'left', 'middle');
    put(ctx, `${num(it.finalScore)}/${num(it.totalMarks)}`, scoreR, mid, `500 22px ${FONT_NUMERIC}`, COLOR.inkMuted, 'right', 'middle');
    put(ctx, `${num(it.percentage)}%`, INNER_R, mid, `700 23px ${FONT_NUMERIC}`, scoreColor(it.percentage), 'right', 'middle');
    ry += 62;
  });
  if (moreCount > 0) {
    put(ctx, `+ ${moreCount} more exam${moreCount === 1 ? '' : 's'} not shown`, INNER_L, ry + 26, `500 21px ${FONT_UI}`, COLOR.inkFaint, 'left', 'middle');
  }

  return y + panelH;
}

// ---- Tasks ----

function drawTaskSection(ctx: Ctx, r: MonthlyReport, startY: number): number {
  const y = sectionTitle(ctx, 'Tasks', startY);
  const t = r.tasks;
  if (t.total === 0) return emptyPanel(ctx, y, `No tasks planned in ${r.label}.`);

  const rows = t.byPriority.filter((p) => p.total > 0);
  const panelH = INNER + 96 + 22 + 34 + rows.length * 74 + INNER - 14;
  panel(ctx, PAD, y, CONTENT_W, panelH);

  put(ctx, String(t.completed), INNER_L, y + INNER + 62, `700 64px ${FONT_NUMERIC}`, COLOR.ink);
  ctx.font = `700 64px ${FONT_NUMERIC}`;
  const cw = ctx.measureText(String(t.completed)).width;
  put(ctx, `of ${t.total} completed`, INNER_L + cw + 14, y + INNER + 60, `500 26px ${FONT_UI}`, COLOR.inkMuted);
  put(ctx, `${t.rate}%`, INNER_R, y + INNER + 62, `700 48px ${FONT_NUMERIC}`, COLOR.accent, 'right');
  bar(ctx, INNER_L, y + INNER + 96, INNER_R - INNER_L, 22, t.completed / t.total, COLOR.accent);

  let ry = y + INNER + 96 + 22 + 34;
  rows.forEach((p) => {
    put(ctx, PRIORITY_LABEL[p.priority], INNER_L, ry + 20, `600 22px ${FONT_UI}`, COLOR.ink);
    put(ctx, `${p.completed}/${p.total}`, INNER_R, ry + 20, `600 22px ${FONT_NUMERIC}`, COLOR.inkMuted, 'right');
    bar(ctx, INNER_L, ry + 34, INNER_R - INNER_L, 12, p.completed / p.total, PRIORITY_COLOR[p.priority]);
    ry += 74;
  });
  return y + panelH;
}

// ---- Study ----

function drawStudySection(ctx: Ctx, r: MonthlyReport, startY: number): number {
  const y = sectionTitle(ctx, 'Study time', startY);
  const s = r.study;
  if (s.totalMs === 0) return emptyPanel(ctx, y, `No study time logged in ${r.label}.`);

  const subjects = s.bySubject.slice(0, MAX_SUBJECT_ROWS);
  const headH = 112;
  const chartH = 260;
  const subjH = 60 + subjects.length * 72;
  const panelH = INNER + headH + chartH + subjH + INNER - 10;
  panel(ctx, PAD, y, CONTENT_W, panelH);

  // -- headline --
  put(ctx, duration(s.totalMs), INNER_L, y + INNER + 62, `700 64px ${FONT_NUMERIC}`, COLOR.accent);
  put(
    ctx,
    `${s.sessions} session${s.sessions === 1 ? '' : 's'} · ${s.activeDays} active day${s.activeDays === 1 ? '' : 's'}`,
    INNER_L,
    y + INNER + 100,
    `500 22px ${FONT_UI}`,
    COLOR.inkMuted
  );
  if (s.longestDay) {
    put(ctx, 'LONGEST DAY', INNER_R, y + INNER + 34, `600 17px ${FONT_UI}`, COLOR.inkFaint, 'right');
    put(ctx, `${ordinal(s.longestDay.day)} · ${duration(s.longestDay.ms)}`, INNER_R, y + INNER + 68, `700 26px ${FONT_NUMERIC}`, COLOR.ink, 'right');
  }

  // -- per-day bars --
  const cx0 = INNER_L + 50;
  const cw = INNER_R - cx0;
  const cy0 = y + INNER + headH + 12;
  const ch = chartH - 12 - 56;
  const maxMs = Math.max(...s.perDayMs);
  const maxHours = Math.max(1, Math.ceil(maxMs / 3_600_000));
  const scaleMs = maxHours * 3_600_000;

  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR.border;
  for (const f of [0, 0.5, 1]) {
    const yy = cy0 + ch - f * ch;
    ctx.beginPath();
    ctx.moveTo(cx0, yy);
    ctx.lineTo(INNER_R, yy);
    ctx.stroke();
    const hours = maxHours * f;
    put(ctx, f === 0 ? '0' : `${num(hours)}h`, cx0 - 12, yy, `500 18px ${FONT_UI}`, COLOR.inkFaint, 'right', 'middle');
  }
  const slot = cw / r.daysInMonth;
  const bw = Math.max(4, slot - 5);
  s.perDayMs.forEach((ms, i) => {
    if (ms <= 0) return;
    const bh = Math.max(6, (ms / scaleMs) * ch);
    roundRectPath(ctx, cx0 + i * slot + (slot - bw) / 2, cy0 + ch - bh, bw, bh, Math.min(5, bw / 2));
    ctx.fillStyle = COLOR.accent;
    ctx.fill();
  });
  const labelDays = new Set([1, 5, 10, 15, 20, 25, r.daysInMonth]);
  labelDays.forEach((d) => {
    put(ctx, String(d), cx0 + (d - 1) * slot + slot / 2, cy0 + ch + 28, `500 18px ${FONT_UI}`, COLOR.inkFaint, 'center');
  });
  put(ctx, 'Day of month', cx0 + cw / 2, cy0 + ch + 52, `600 19px ${FONT_UI}`, COLOR.inkMuted, 'center');

  // -- by subject --
  let sy = y + INNER + headH + chartH;
  put(ctx, 'BY SUBJECT', INNER_L, sy + 30, `600 17px ${FONT_UI}`, COLOR.inkFaint);
  sy += 50;
  const top = subjects[0]?.ms ?? 1;
  subjects.forEach((sub) => {
    ctx.beginPath();
    ctx.arc(INNER_L + 8, sy + 18, 8, 0, Math.PI * 2);
    ctx.fillStyle = sub.color;
    ctx.fill();
    put(ctx, fit(ctx, sub.name, `600 23px ${FONT_UI}`, INNER_R - INNER_L - 220), INNER_L + 28, sy + 18, `600 23px ${FONT_UI}`, COLOR.ink, 'left', 'middle');
    put(ctx, duration(sub.ms), INNER_R, sy + 18, `700 23px ${FONT_NUMERIC}`, COLOR.inkMuted, 'right', 'middle');
    bar(ctx, INNER_L, sy + 40, INNER_R - INNER_L, 14, sub.ms / top, sub.color);
    sy += 72;
  });
  const more = s.bySubject.length - subjects.length;
  if (more > 0) put(ctx, `+ ${more} more subject${more === 1 ? '' : 's'}`, INNER_L, sy + 4, `500 20px ${FONT_UI}`, COLOR.inkFaint);

  return y + panelH;
}

// ---------------------------------------------------------------------------
// public
// ---------------------------------------------------------------------------

/**
 * Draws the whole report and returns its total height in px (at 1x).
 *
 * The height depends on the data (number of exams, subjects...), so the
 * caller runs this once on a scratch canvas to learn the height, sizes the
 * real canvas, then calls it again with `totalHeight` so the background
 * covers everything.
 */
export function drawMonthlyReport(
  ctx: Ctx,
  report: MonthlyReport,
  logo: HTMLImageElement | null | undefined,
  totalHeight?: number
): number {
  ctx.save();
  if (totalHeight) {
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, REPORT_WIDTH, totalHeight);
  }

  let y = drawHeader(ctx, report, logo);
  y = drawKpis(ctx, report, y) + 56;
  y = drawExamSection(ctx, report, y) + 56;
  y = drawTaskSection(ctx, report, y) + 56;
  y = drawStudySection(ctx, report, y) + 48;

  // footer
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(REPORT_WIDTH - PAD, y);
  ctx.stroke();
  put(ctx, 'Generated by Tally', PAD, y + 50, `500 20px ${FONT_UI}`, COLOR.inkFaint, 'left', 'middle');
  put(
    ctx,
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    REPORT_WIDTH - PAD,
    y + 50,
    `500 20px ${FONT_UI}`,
    COLOR.inkFaint,
    'right',
    'middle'
  );

  ctx.restore();
  return Math.ceil(y + 50 + 40);
}
