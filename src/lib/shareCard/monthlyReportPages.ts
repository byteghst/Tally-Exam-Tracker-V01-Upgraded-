import type { MonthlyReport, ReportExam } from '@/lib/monthlyReport';
import { toneColor } from '@/lib/palette';
import type { ExamType, TaskPriority } from '@/types';

/**
 * Paginated A4 layout of the monthly report.
 *
 * Content is laid out as blocks that flow down the page; a block that doesn't
 * fit moves to the next page, and long lists (exam results, study subjects)
 * continue across pages with their heading repeated. Nothing is truncated.
 * Each page is then drawn on its own canvas and packed into the PDF.
 */

/** Logical page size: A4 proportions (1 : 1.4142) at 1080 wide. */
export const PAGE_WIDTH = 1080;
export const PAGE_HEIGHT = 1527;

const PAD = 64;
/** padding inside each panel */
const INNER = 26;
const CONTENT_W = PAGE_WIDTH - PAD * 2;
const INNER_L = PAD + INNER;
const INNER_R = PAD + CONTENT_W - INNER;

const FOOTER_H = 100;
const CONTENT_BOTTOM = PAGE_HEIGHT - FOOTER_H;
/** where content starts on pages 2+, below the running header */
const RUNNING_TOP = 140;
/** height of a section heading, including the space under it */
const TITLE_H = 68;
/** vertical space between blocks */
const GAP = 44;
const EMPTY_H = 130;

// Brand tokens as literal hex: canvas drawing happens outside the CSS cascade.
// Warm paper and ink with a persimmon accent; no blue anywhere.
const COLOR = {
  bg: '#F6F1E8',
  panel: '#FBF8F2',
  ink: '#1C1814',
  inkMuted: '#686056',
  inkFaint: '#92897D',
  accent: '#D94F2D',
  accentSoft: '#F9E3D8',
  success: '#2F7D5B',
  warning: '#C98B12',
  danger: '#A82038',
  low: '#C9486B',
  border: '#DDD5C7',
  track: '#EAE3D6'
};

// Same font roles as the app (bundled via @fontsource; loaded by prepareCardAssets()).
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_NUMERIC = "'Space Grotesk', system-ui, sans-serif";
const FONT_UI = "'Plus Jakarta Sans', system-ui, sans-serif";

const TYPE_LABEL: Record<ExamType, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };
const PRIORITY_COLOR: Record<TaskPriority, string> = { high: COLOR.danger, medium: COLOR.warning, low: COLOR.success };

type Ctx = CanvasRenderingContext2D;
type Align = 'left' | 'right' | 'center';
type DrawFn = (ctx: Ctx) => void;

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

function hline(ctx: Ctx, x1: number, x2: number, y: number, color: string = COLOR.border, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
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

function sectionTitle(ctx: Ctx, text: string, y: number) {
  put(ctx, text, PAD, y + 40, `600 38px ${FONT_DISPLAY}`, COLOR.ink);
}

function emptyBlock(ctx: Ctx, title: string, y: number, message: string) {
  sectionTitle(ctx, title, y);
  const top = y + TITLE_H;
  panel(ctx, PAD, top, CONTENT_W, EMPTY_H);
  put(ctx, message, INNER_L, top + EMPTY_H / 2, `500 26px ${FONT_UI}`, COLOR.inkMuted, 'left', 'middle');
}

// ---------------------------------------------------------------------------
// page flow
// ---------------------------------------------------------------------------

class Flow {
  readonly pages: DrawFn[][] = [[]];
  y = PAD;
  /** true until something has been placed on the current page */
  fresh = true;

  room(): number {
    return CONTENT_BOTTOM - this.y;
  }

  newPage() {
    this.pages.push([]);
    this.y = RUNNING_TOP;
    this.fresh = true;
  }

  /** Places a block of the given height; starts a new page first if it doesn't fit. */
  add(height: number, draw: (ctx: Ctx, y: number) => void) {
    if (!this.fresh && this.y + height > CONTENT_BOTTOM) this.newPage();
    const y = this.y;
    this.pages[this.pages.length - 1].push((ctx) => draw(ctx, y));
    this.y += height;
    this.fresh = false;
  }

  /** Space between blocks; skipped at the top of a page. */
  gap(h: number = GAP) {
    if (!this.fresh) this.y += h;
  }
}

interface RowListSpec<T> {
  title: string;
  continued: string;
  rows: T[];
  rowH: number;
  headerH: number;
  drawHeader?: (ctx: Ctx, y: number) => void;
  drawRow: (ctx: Ctx, row: T, y: number) => void;
}

/** A titled panel of rows that continues onto following pages as needed. */
function addRowList<T>(flow: Flow, spec: RowListSpec<T>) {
  const overhead = TITLE_H + INNER + spec.headerH + INNER;
  let i = 0;
  let first = true;
  flow.gap();
  while (i < spec.rows.length) {
    const remaining = spec.rows.length - i;
    // don't start a list at the very bottom of a page with only a row or two
    if (!flow.fresh && flow.room() < overhead + Math.min(3, remaining) * spec.rowH) flow.newPage();
    let take = Math.max(1, Math.min(remaining, Math.floor((flow.room() - overhead) / spec.rowH)));
    if (remaining - take === 1 && take > 1) take -= 1; // never strand a single row on the next page
    const chunk = spec.rows.slice(i, i + take);
    const heading = first ? spec.title : spec.continued;
    const height = overhead + chunk.length * spec.rowH;
    flow.add(height, (ctx, y) => {
      sectionTitle(ctx, heading, y);
      panel(ctx, PAD, y + TITLE_H, CONTENT_W, height - TITLE_H);
      const top = y + TITLE_H + INNER;
      spec.drawHeader?.(ctx, top);
      chunk.forEach((row, k) => spec.drawRow(ctx, row, top + spec.headerH + k * spec.rowH));
    });
    i += take;
    first = false;
    if (i < spec.rows.length) flow.newPage();
  }
}

// ---------------------------------------------------------------------------
// blocks
// ---------------------------------------------------------------------------

const HEADER_H = 216;

function drawHeader(ctx: Ctx, r: MonthlyReport, logo: HTMLImageElement | null | undefined, y: number) {
  const midY = y + 22;
  if (logo) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo, PAD, midY - 28, 56, 56);
  }
  const wordX = PAD + 56 + 18;
  const wordFont = `600 34px ${FONT_DISPLAY}`;
  put(ctx, 'Tally', wordX, midY, wordFont, COLOR.ink, 'left', 'middle');
  ctx.font = wordFont;
  const tallyW = ctx.measureText('Tally').width;
  put(ctx, '.', wordX + tallyW, midY, wordFont, COLOR.accent, 'left', 'middle');

  put(ctx, 'Monthly Report', PAD, y + 146, `700 56px ${FONT_DISPLAY}`, COLOR.ink);
  put(ctx, r.label, PAD, y + 194, `400 30px ${FONT_UI}`, COLOR.inkMuted);
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
  put(ctx, label, x + INNER, y + 42, `600 19px ${FONT_UI}`, COLOR.inkFaint);
  const valueFont = `700 58px ${FONT_NUMERIC}`;
  put(ctx, value, x + INNER, y + 102, valueFont, valueColor);
  if (suffix) {
    ctx.font = valueFont;
    const vw = ctx.measureText(value).width;
    put(ctx, suffix, x + INNER + vw + 10, y + 102, `600 28px ${FONT_NUMERIC}`, COLOR.inkFaint);
  }
  put(ctx, fit(ctx, sub, `500 21px ${FONT_UI}`, w - INNER * 2), x + INNER, y + 136, `500 21px ${FONT_UI}`, subColor);
}

const KPI_H = 156;
const KPI_GAP = 18;
const KPI_BLOCK_H = 3 * KPI_H + 2 * KPI_GAP;

function drawKpis(ctx: Ctx, r: MonthlyReport, y: number) {
  const w = (CONTENT_W - KPI_GAP) / 2;
  const e = r.exams;
  const t = r.tasks;
  const s = r.study;

  const changeText =
    e.change === null
      ? e.average === null
        ? ''
        : 'No earlier month to compare'
      : e.change === 0
        ? `Same as ${r.prevLabel}`
        : `${e.change > 0 ? '▲' : '▼'} ${num(Math.abs(e.change))} pts vs ${r.prevLabel}`;
  const changeColor = e.change === null || e.change === 0 ? COLOR.inkMuted : e.change > 0 ? COLOR.success : COLOR.danger;

  const studyDelta = s.totalMs - s.previousTotalMs;
  const sessionsText = `${s.sessions} session${s.sessions === 1 ? '' : 's'}`;
  const studySub =
    s.sessions === 0
      ? 'No study time logged'
      : s.previousTotalMs > 0
        ? `${sessionsText} · ${studyDelta >= 0 ? '+' : '-'}${duration(Math.abs(studyDelta))} vs ${r.prevLabel}`
        : sessionsText;

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
      label: 'LOWEST SCORE',
      value: e.lowest ? `${num(e.lowest.percentage)}%` : '—',
      color: COLOR.low,
      sub: e.lowest ? e.lowest.name : 'No scored exams',
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
    }
  ];

  cells.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    kpi(ctx, PAD + col * (w + KPI_GAP), y + row * (KPI_H + KPI_GAP), w, KPI_H, c.label, c.value, c.color, c.sub, c.subColor);
  });
}

// ---- exam score chart (+ type chips) ----

function addExamChart(flow: Flow, r: MonthlyReport, measure: Ctx) {
  const e = r.exams;
  flow.gap();
  if (e.count === 0) {
    const message =
      e.unscored > 0
        ? `${e.unscored} exam${e.unscored === 1 ? '' : 's'} this month, no results recorded yet.`
        : `No exams in ${r.label}.`;
    flow.add(TITLE_H + EMPTY_H, (ctx, y) => emptyBlock(ctx, 'Exam performance', y, message));
    return;
  }

  const chartH = 300;
  // type chips flow onto a new row when they don't fit side by side
  const chipFont = `600 20px ${FONT_UI}`;
  measure.font = chipFont;
  let chipRow = 0;
  let chipCursor = 0;
  const chips = e.byType.map((g) => {
    const text = `${TYPE_LABEL[g.type]} · ${g.count} exam${g.count === 1 ? '' : 's'} · avg ${num(g.average)}%`;
    const w = measure.measureText(text).width + 36;
    if (chipCursor > 0 && INNER_L + chipCursor + w > INNER_R) {
      chipRow += 1;
      chipCursor = 0;
    }
    const placed = { text, w, x: INNER_L + chipCursor, row: chipRow };
    chipCursor += w + 12;
    return placed;
  });
  const chipsH = chips.length > 0 ? (chipRow + 1) * 62 + 22 : 0;
  const height = TITLE_H + INNER + chartH + chipsH + INNER;

  flow.add(height, (ctx, y) => {
    sectionTitle(ctx, 'Exam performance', y);
    const top = y + TITLE_H;
    panel(ctx, PAD, top, CONTENT_W, height - TITLE_H);

    const cx0 = INNER_L + 56;
    const cw = INNER_R - cx0;
    const cy0 = top + INNER + 36;
    const ch = chartH - 36 - 70;

    for (const tick of [0, 25, 50, 75, 100]) {
      const yy = cy0 + ch - (tick / 100) * ch;
      hline(ctx, cx0, INNER_R, yy);
      put(ctx, String(tick), cx0 - 14, yy, `500 19px ${FONT_UI}`, COLOR.inkFaint, 'right', 'middle');
    }

    const pts = e.items.map((it) => {
      const day = Number(it.date.slice(8, 10));
      return {
        id: it.id,
        day,
        pct: it.percentage,
        x: cx0 + 22 + ((day - 1) / (r.daysInMonth - 1)) * (cw - 44),
        y: cy0 + ch - (it.percentage / 100) * ch
      };
    });

    if (pts.length >= 2) {
      const grad = ctx.createLinearGradient(0, cy0, 0, cy0 + ch);
      grad.addColorStop(0, COLOR.accentSoft);
      grad.addColorStop(1, 'rgba(249,227,216,0)');
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

    // The best and lowest exams of the month get their own colour and label.
    const bestId = e.best && e.lowest && e.best.id !== e.lowest.id ? e.best.id : null;
    const lowId = e.best && e.lowest && e.best.id !== e.lowest.id ? e.lowest.id : null;

    let lastLabelX = -1000;
    pts.forEach((p) => {
      const isBest = p.id === bestId;
      const isLow = p.id === lowId;
      const ring = isBest ? COLOR.success : isLow ? COLOR.low : COLOR.accent;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isBest || isLow ? 13 : 9, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.panel;
      ctx.fill();
      ctx.lineWidth = isBest || isLow ? 6 : 4;
      ctx.strokeStyle = ring;
      ctx.stroke();
      if (pts.length <= 8 || isBest || isLow) {
        put(
          ctx,
          `${num(p.pct)}%`,
          p.x,
          isLow ? p.y + 38 : p.y - 22,
          `700 20px ${FONT_NUMERIC}`,
          isBest || isLow ? ring : COLOR.ink,
          'center'
        );
      }
      if (p.x - lastLabelX >= 30) {
        put(ctx, String(p.day), p.x, cy0 + ch + 32, `500 19px ${FONT_UI}`, COLOR.inkFaint, 'center');
        lastLabelX = p.x;
      }
    });
    put(ctx, 'Day of month', cx0 + cw / 2, cy0 + ch + 62, `600 20px ${FONT_UI}`, COLOR.inkMuted, 'center');

    const chipsTop = top + INNER + chartH;
    for (const c of chips) {
      const cyTop = chipsTop + 6 + c.row * 62;
      roundRectPath(ctx, c.x, cyTop, c.w, 50, 25);
      ctx.fillStyle = COLOR.accentSoft;
      ctx.fill();
      put(ctx, c.text, c.x + 18, cyTop + 25, chipFont, COLOR.accent, 'left', 'middle');
    }
  });
}

// ---- exam results table (every exam, across as many pages as needed) ----

function addExamTable(flow: Flow, r: MonthlyReport) {
  if (r.exams.items.length === 0) return;
  const nameX = INNER_L + 118;
  const typeX = INNER_R - 360;
  const scoreR = INNER_R - 118;
  const hdr = `600 17px ${FONT_UI}`;

  addRowList<ReportExam>(flow, {
    title: 'Exam results',
    continued: 'Exam results (continued)',
    rows: r.exams.items,
    rowH: 58,
    headerH: 48,
    drawHeader: (ctx, y) => {
      put(ctx, 'DATE', INNER_L, y + 24, hdr, COLOR.inkFaint, 'left', 'middle');
      put(ctx, 'EXAM', nameX, y + 24, hdr, COLOR.inkFaint, 'left', 'middle');
      put(ctx, 'TYPE', typeX, y + 24, hdr, COLOR.inkFaint, 'left', 'middle');
      put(ctx, 'SCORE', scoreR, y + 24, hdr, COLOR.inkFaint, 'right', 'middle');
      put(ctx, '%', INNER_R, y + 24, hdr, COLOR.inkFaint, 'right', 'middle');
    },
    drawRow: (ctx, it, y) => {
      hline(ctx, INNER_L, INNER_R, y);
      const mid = y + 30;
      put(ctx, shortDate(it.date), INNER_L, mid, `500 22px ${FONT_UI}`, COLOR.inkMuted, 'left', 'middle');
      put(ctx, fit(ctx, it.name, `600 23px ${FONT_UI}`, typeX - 20 - nameX), nameX, mid, `600 23px ${FONT_UI}`, COLOR.ink, 'left', 'middle');
      put(ctx, TYPE_LABEL[it.type], typeX, mid, `500 20px ${FONT_UI}`, COLOR.inkMuted, 'left', 'middle');
      put(ctx, `${num(it.finalScore)}/${num(it.totalMarks)}`, scoreR, mid, `500 22px ${FONT_NUMERIC}`, COLOR.inkMuted, 'right', 'middle');
      put(ctx, `${num(it.percentage)}%`, INNER_R, mid, `700 23px ${FONT_NUMERIC}`, scoreColor(it.percentage), 'right', 'middle');
    }
  });
}

// ---- tasks ----

function addTasks(flow: Flow, r: MonthlyReport) {
  const t = r.tasks;
  flow.gap();
  if (t.total === 0) {
    flow.add(TITLE_H + EMPTY_H, (ctx, y) => emptyBlock(ctx, 'Tasks', y, `No tasks planned in ${r.label}.`));
    return;
  }
  const rows = t.byPriority.filter((p) => p.total > 0);
  const panelH = INNER + 96 + 22 + 34 + rows.length * 74 + INNER - 14;

  flow.add(TITLE_H + panelH, (ctx, y) => {
    sectionTitle(ctx, 'Tasks', y);
    const top = y + TITLE_H;
    panel(ctx, PAD, top, CONTENT_W, panelH);

    put(ctx, String(t.completed), INNER_L, top + INNER + 62, `700 64px ${FONT_NUMERIC}`, COLOR.ink);
    ctx.font = `700 64px ${FONT_NUMERIC}`;
    const cw = ctx.measureText(String(t.completed)).width;
    put(ctx, `of ${t.total} completed`, INNER_L + cw + 14, top + INNER + 60, `500 26px ${FONT_UI}`, COLOR.inkMuted);
    put(ctx, `${t.rate}%`, INNER_R, top + INNER + 62, `700 48px ${FONT_NUMERIC}`, COLOR.accent, 'right');
    bar(ctx, INNER_L, top + INNER + 96, INNER_R - INNER_L, 22, t.completed / t.total, COLOR.accent);

    let ry = top + INNER + 96 + 22 + 34;
    rows.forEach((p) => {
      put(ctx, PRIORITY_LABEL[p.priority], INNER_L, ry + 20, `600 22px ${FONT_UI}`, COLOR.ink);
      put(ctx, `${p.completed}/${p.total}`, INNER_R, ry + 20, `600 22px ${FONT_NUMERIC}`, COLOR.inkMuted, 'right');
      bar(ctx, INNER_L, ry + 34, INNER_R - INNER_L, 12, p.completed / p.total, PRIORITY_COLOR[p.priority]);
      ry += 74;
    });
  });
}

// ---- study time: overview chart, then every subject ----

function addStudy(flow: Flow, r: MonthlyReport) {
  const s = r.study;
  flow.gap();
  if (s.totalMs === 0) {
    flow.add(TITLE_H + EMPTY_H, (ctx, y) => emptyBlock(ctx, 'Study time', y, `No study time logged in ${r.label}.`));
    return;
  }

  const headH = 112;
  const chartH = 250;
  const panelH = INNER + headH + chartH + INNER - 10;

  flow.add(TITLE_H + panelH, (ctx, y) => {
    sectionTitle(ctx, 'Study time', y);
    const top = y + TITLE_H;
    panel(ctx, PAD, top, CONTENT_W, panelH);

    put(ctx, duration(s.totalMs), INNER_L, top + INNER + 62, `700 64px ${FONT_NUMERIC}`, COLOR.accent);
    put(
      ctx,
      `${s.sessions} session${s.sessions === 1 ? '' : 's'} · ${s.activeDays} active day${s.activeDays === 1 ? '' : 's'}`,
      INNER_L,
      top + INNER + 100,
      `500 22px ${FONT_UI}`,
      COLOR.inkMuted
    );
    if (s.longestDay) {
      put(ctx, 'LONGEST DAY', INNER_R, top + INNER + 34, `600 17px ${FONT_UI}`, COLOR.inkFaint, 'right');
      put(ctx, `${ordinal(s.longestDay.day)} · ${duration(s.longestDay.ms)}`, INNER_R, top + INNER + 68, `700 26px ${FONT_NUMERIC}`, COLOR.ink, 'right');
    }

    const cx0 = INNER_L + 50;
    const cw = INNER_R - cx0;
    const cy0 = top + INNER + headH + 12;
    const ch = chartH - 12 - 56;
    const maxHours = Math.max(1, Math.ceil(Math.max(...s.perDayMs) / 3_600_000));
    const scaleMs = maxHours * 3_600_000;

    for (const f of [0, 0.5, 1]) {
      const yy = cy0 + ch - f * ch;
      hline(ctx, cx0, INNER_R, yy);
      put(ctx, f === 0 ? '0' : `${num(maxHours * f)}h`, cx0 - 12, yy, `500 18px ${FONT_UI}`, COLOR.inkFaint, 'right', 'middle');
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
    new Set([1, 5, 10, 15, 20, 25, r.daysInMonth]).forEach((d) => {
      put(ctx, String(d), cx0 + (d - 1) * slot + slot / 2, cy0 + ch + 28, `500 18px ${FONT_UI}`, COLOR.inkFaint, 'center');
    });
    put(ctx, 'Day of month', cx0 + cw / 2, cy0 + ch + 52, `600 19px ${FONT_UI}`, COLOR.inkMuted, 'center');
  });

  const nameFont = `600 23px ${FONT_UI}`;
  addRowList(flow, {
    title: 'Study by subject',
    continued: 'Study by subject (continued)',
    rows: s.bySubject,
    rowH: 80,
    headerH: 0,
    drawRow: (ctx, sub, y) => {
      // subjects saved with the old blue/violet colours are shown in the new palette
      const color = toneColor(sub.color);
      ctx.beginPath();
      ctx.arc(INNER_L + 8, y + 22, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      put(ctx, fit(ctx, sub.name, nameFont, INNER_R - INNER_L - 270), INNER_L + 28, y + 22, nameFont, COLOR.ink, 'left', 'middle');
      const share = Math.round((sub.ms / s.totalMs) * 100);
      put(ctx, `${duration(sub.ms)} · ${share}%`, INNER_R, y + 22, `700 23px ${FONT_NUMERIC}`, COLOR.inkMuted, 'right', 'middle');
      bar(ctx, INNER_L, y + 46, INNER_R - INNER_L, 14, sub.ms / s.bySubject[0].ms, color);
    }
  });
}

// ---------------------------------------------------------------------------
// page furniture + public API
// ---------------------------------------------------------------------------

function drawRunningHeader(ctx: Ctx, r: MonthlyReport, logo: HTMLImageElement | null | undefined) {
  const midY = 56;
  if (logo) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo, PAD, midY - 18, 36, 36);
  }
  const wordX = PAD + 36 + 12;
  const wordFont = `600 26px ${FONT_DISPLAY}`;
  put(ctx, 'Tally', wordX, midY, wordFont, COLOR.ink, 'left', 'middle');
  ctx.font = wordFont;
  const w = ctx.measureText('Tally').width;
  put(ctx, '.', wordX + w, midY, wordFont, COLOR.accent, 'left', 'middle');
  put(ctx, `Monthly Report · ${r.label}`, PAGE_WIDTH - PAD, midY, `500 20px ${FONT_UI}`, COLOR.inkFaint, 'right', 'middle');
  hline(ctx, PAD, PAGE_WIDTH - PAD, 96, COLOR.border, 2);
}

function drawFooter(ctx: Ctx, pageNo: number, total: number, generated: string) {
  hline(ctx, PAD, PAGE_WIDTH - PAD, PAGE_HEIGHT - 84, COLOR.border, 2);
  put(ctx, `Generated by Tally · ${generated}`, PAD, PAGE_HEIGHT - 48, `500 19px ${FONT_UI}`, COLOR.inkFaint, 'left', 'middle');
  put(ctx, `Page ${pageNo} of ${total}`, PAGE_WIDTH - PAD, PAGE_HEIGHT - 48, `600 19px ${FONT_UI}`, COLOR.inkMuted, 'right', 'middle');
}

export interface ReportLayout {
  pageCount: number;
  /** Draws page `index` (0-based) at the logical size PAGE_WIDTH x PAGE_HEIGHT. */
  drawPage: (ctx: Ctx, index: number) => void;
}

/**
 * Lays the report out across pages. `measure` is any 2D context, used only to
 * measure text while laying out.
 */
export function layoutMonthlyReport(
  report: MonthlyReport,
  logo: HTMLImageElement | null | undefined,
  measure: Ctx
): ReportLayout {
  const flow = new Flow();
  flow.add(HEADER_H, (ctx, y) => drawHeader(ctx, report, logo, y));
  flow.gap(32);
  flow.add(KPI_BLOCK_H, (ctx, y) => drawKpis(ctx, report, y));
  addExamChart(flow, report, measure);
  addExamTable(flow, report);
  addTasks(flow, report);
  addStudy(flow, report);

  const pageCount = flow.pages.length;
  const generated = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    pageCount,
    drawPage(ctx, index) {
      ctx.save();
      ctx.fillStyle = COLOR.bg;
      ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      if (index > 0) drawRunningHeader(ctx, report, logo);
      for (const draw of flow.pages[index]) draw(ctx);
      drawFooter(ctx, index + 1, pageCount, generated);
      ctx.restore();
    }
  };
}
