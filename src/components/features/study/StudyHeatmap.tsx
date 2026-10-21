import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { toneColor } from '@/lib/palette';
import { useSettingsStore } from '@/store/settingsStore';
import type { StudySession, StudySubject } from '@/store/studyStore';

const HOUR_MS = 3_600_000;
/** A day counts as studied from one minute up, so an accidental tap doesn't keep a streak alive. */
const MIN_ACTIVE_MS = 60_000;
const MIN_WEEKS = 14;
const MAX_WEEKS = 53;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Empty, then four shades of the accent colour (under 1h, 1-2h, 2-4h, 4h+). */
const LEVEL_CLASSES = ['bg-ink/[0.06]', 'bg-accent/25', 'bg-accent/50', 'bg-accent/75', 'bg-accent'] as const;

function levelOf(ms: number): number {
  if (ms < MIN_ACTIVE_MS) return 0;
  if (ms < HOUR_MS) return 1;
  if (ms < 2 * HOUR_MS) return 2;
  if (ms < 4 * HOUR_MS) return 3;
  return 4;
}

interface DayData {
  ms: number;
  sessions: number;
  bySubject: Map<string, number>;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** yyyy-mm-dd in the phone's own time zone. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Whole-day index of a yyyy-mm-dd key, unaffected by daylight-saving shifts. */
function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return ms > 0 ? '<1m' : '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Study time per calendar day. A session that runs past midnight is split
 * between the days it covers, in proportion to the clock time on each day.
 */
function buildDays(sessions: StudySession[]): Map<string, DayData> {
  const days = new Map<string, DayData>();
  const add = (key: string, ms: number, subjectId: string, counted: boolean): void => {
    let day = days.get(key);
    if (!day) {
      day = { ms: 0, sessions: 0, bySubject: new Map() };
      days.set(key, day);
    }
    day.ms += ms;
    if (counted) day.sessions += 1;
    day.bySubject.set(subjectId, (day.bySubject.get(subjectId) ?? 0) + ms);
  };

  for (const s of sessions) {
    const span = s.end - s.start;
    const endKey = dayKey(new Date(s.end));
    if (span <= 0) {
      add(endKey, s.durationMs, s.subjectId, true);
      continue;
    }
    const startDate = new Date(s.start);
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    for (let guard = 0; cursor.getTime() < s.end && guard < 14; guard += 1) {
      const next = addDays(cursor, 1);
      const from = Math.max(s.start, cursor.getTime());
      const to = Math.min(s.end, next.getTime());
      if (to > from) {
        const key = dayKey(cursor);
        add(key, s.durationMs * ((to - from) / span), s.subjectId, key === endKey);
      }
      cursor = next;
    }
  }
  return days;
}

function computeStreaks(days: Map<string, DayData>, todayKey: string): { current: number; longest: number } {
  const activeKeys = [...days.entries()]
    .filter(([, d]) => d.ms >= MIN_ACTIVE_MS)
    .map(([k]) => k)
    .sort();
  const numbers = new Set(activeKeys.map(dayNumber));

  let longest = 0;
  let run = 0;
  let prev = -Infinity;
  for (const k of activeKeys) {
    const n = dayNumber(k);
    run = n === prev + 1 ? run + 1 : 1;
    prev = n;
    if (run > longest) longest = run;
  }

  // Counts back from today; a day that simply hasn't been studied yet doesn't break the streak.
  let n = dayNumber(todayKey);
  if (!numbers.has(n)) n -= 1;
  let current = 0;
  while (numbers.has(n)) {
    current += 1;
    n -= 1;
  }
  return { current, longest };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-ink/[0.04] px-3 py-2.5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-serif text-3xl leading-none tracking-tight text-ink">{value}</p>
    </div>
  );
}

/**
 * A calendar of study days: one square per day, darker for more time studied.
 * Tap a day to see what was studied on it. Scrolls sideways through older weeks.
 */
export function StudyHeatmap({ sessions, subjects }: { sessions: StudySession[]; subjects: StudySubject[] }) {
  const firstDayOfWeek = useSettingsStore((s) => s.settings.firstDayOfWeek);
  const todayKey = dayKey(new Date());
  const [selected, setSelected] = useState(todayKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => buildDays(sessions), [sessions]);
  const streaks = useMemo(() => computeStreaks(days, todayKey), [days, todayKey]);

  const grid = useMemo(() => {
    const today = parseKey(todayKey);
    let firstMs = today.getTime();
    for (const s of sessions) firstMs = Math.min(firstMs, s.start);
    const firstDate = new Date(firstMs);
    const first = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
    const spanDays = Math.round((today.getTime() - first.getTime()) / 86_400_000);
    const weeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.ceil(spanDays / 7) + 1));
    const offset = (today.getDay() - firstDayOfWeek + 7) % 7;
    const start = addDays(today, -offset - (weeks - 1) * 7);

    const columns = Array.from({ length: weeks }, (_, w) =>
      Array.from({ length: 7 }, (_, r) => {
        const date = addDays(start, w * 7 + r);
        return date.getTime() > today.getTime() ? null : { key: dayKey(date), date };
      })
    );
    const monthLabels = columns.map((_, w) => {
      if (w === 0) return '';
      const here = addDays(start, w * 7);
      const before = addDays(start, (w - 1) * 7);
      return here.getMonth() !== before.getMonth()
        ? here.toLocaleDateString(undefined, { month: 'short' })
        : '';
    });
    return { columns, monthLabels };
  }, [sessions, firstDayOfWeek, todayKey]);

  // Open on the most recent weeks.
  const weekCount = grid.columns.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weekCount]);

  const activeDays = useMemo(() => {
    let count = 0;
    for (const column of grid.columns) {
      for (const cell of column) {
        if (cell && levelOf(days.get(cell.key)?.ms ?? 0) > 0) count += 1;
      }
    }
    return count;
  }, [grid, days]);

  const selectedDay = days.get(selected);
  const breakdown = useMemo(() => {
    if (!selectedDay) return [];
    return [...selectedDay.bySubject.entries()]
      .map(([subjectId, ms]) => ({ subject: subjects.find((s) => s.id === subjectId), ms }))
      .filter((e): e is { subject: StudySubject; ms: number } => e.subject !== undefined)
      .sort((a, b) => b.ms - a.ms);
  }, [selectedDay, subjects]);

  return (
    <GlassCard className="p-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Streak" value={`${streaks.current}d`} />
        <Stat label="Best" value={`${streaks.longest}d`} />
        <Stat label="Active days" value={String(activeDays)} />
      </div>

      <div className="mt-4 flex gap-2">
        <div className="flex shrink-0 flex-col gap-[3px] pt-[17px]">
          {Array.from({ length: 7 }, (_, r) => (
            <span key={r} className="h-[14px] text-[10px] leading-[14px] text-ink-faint">
              {r % 2 === 1 ? DAY_LABELS[(firstDayOfWeek + r) % 7] : ''}
            </span>
          ))}
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="flex w-max gap-[3px]">
            {grid.columns.map((column, w) => (
              <div key={w} className="flex w-[14px] shrink-0 flex-col gap-[3px]">
                <span className="h-[14px] whitespace-nowrap text-[10px] leading-[14px] text-ink-faint">
                  {grid.monthLabels[w]}
                </span>
                {column.map((cell, r) => {
                  if (!cell) return <span key={r} className="h-[14px] w-[14px]" aria-hidden />;
                  const ms = days.get(cell.key)?.ms ?? 0;
                  const isSelected = selected === cell.key;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelected(cell.key)}
                      aria-pressed={isSelected}
                      aria-label={`${cell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${formatDuration(ms)}`}
                      className={clsx(
                        'h-[14px] w-[14px] rounded-[3px]',
                        LEVEL_CLASSES[levelOf(ms)],
                        isSelected && 'ring-2 ring-ink ring-offset-1 ring-offset-surface-raised'
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-ink-faint">
        <span>Less</span>
        {LEVEL_CLASSES.map((c) => (
          <span key={c} className={clsx('h-[10px] w-[10px] rounded-[2px]', c)} />
        ))}
        <span>More</span>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Start the timer on a subject and your study days will fill in here.</p>
      ) : (
        <div className="mt-4 rounded-control bg-ink/[0.04] px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {parseKey(selected).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              {selectedDay && (
                <p className="text-xs text-ink-muted">
                  {selectedDay.sessions} {selectedDay.sessions === 1 ? 'session' : 'sessions'}
                </p>
              )}
            </div>
            <p className="tabular-nums text-sm font-semibold text-ink">{formatDuration(selectedDay?.ms ?? 0)}</p>
          </div>
          {breakdown.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5">
              {breakdown.map(({ subject, ms }) => (
                <li key={subject.id} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: toneColor(subject.color) }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{subject.name}</span>
                  <span className="tabular-nums text-xs text-ink-muted">{formatDuration(ms)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-ink-muted">No study logged this day.</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
