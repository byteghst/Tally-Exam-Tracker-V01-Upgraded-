import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/Badge';
import { toISODate, parseISODate } from '@/lib/dates';
import { useChartColors } from '@/lib/chartTheme';
import { useStudyStore } from '@/store/studyStore';

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];
const HOUR_MS = 3_600_000;

interface DayRow {
  date: string;
  label: string;
  totalMs: number;
  /** milliseconds studied per subject id */
  bySubject: Record<string, number>;
  /** hours per subject id, which is what the bars draw */
  [subjectId: string]: number | string | Record<string, number>;
}

function fmt(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function StudyHoursChart() {
  const c = useChartColors();
  const sessions = useStudyStore((s) => s.sessions);
  const subjects = useStudyStore((s) => s.subjects);
  const [range, setRange] = useState<Range>(14);

  const { rows, subjectTotals, totalMs, bestDay, activeDays } = useMemo(() => {
    const today = new Date();
    const days: DayRow[] = [];
    const index = new Map<string, DayRow>();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = toISODate(d);
      const parsed = parseISODate(iso);
      const row = { date: iso, label: `${parsed.getMonth() + 1}/${parsed.getDate()}`, totalMs: 0, bySubject: {} } as DayRow;
      days.push(row);
      index.set(iso, row);
    }

    const known = new Set(subjects.map((s) => s.id));
    const perSubject = new Map<string, number>();
    for (const s of sessions) {
      if (!known.has(s.subjectId)) continue;
      const row = index.get(toISODate(new Date(s.start)));
      if (!row) continue;
      row.totalMs += s.durationMs;
      row.bySubject[s.subjectId] = (row.bySubject[s.subjectId] ?? 0) + s.durationMs;
      perSubject.set(s.subjectId, (perSubject.get(s.subjectId) ?? 0) + s.durationMs);
    }

    const totals = subjects
      .map((s) => ({ subject: s, ms: perSubject.get(s.id) ?? 0 }))
      .filter((t) => t.ms > 0)
      .sort((a, b) => b.ms - a.ms);

    for (const row of days) {
      for (const t of totals) row[t.subject.id] = (row.bySubject[t.subject.id] ?? 0) / HOUR_MS;
    }

    const total = days.reduce((sum, d) => sum + d.totalMs, 0);
    const best = days.reduce<DayRow | null>((b, d) => (d.totalMs > (b?.totalMs ?? 0) ? d : b), null);
    return {
      rows: days,
      subjectTotals: totals,
      totalMs: total,
      bestDay: best,
      activeDays: days.filter((d) => d.totalMs > 0).length
    };
  }, [sessions, subjects, range]);

  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, s.name] as const)), [subjects]);
  const subjectColor = useMemo(() => new Map(subjects.map((s) => [s.id, s.color] as const)), [subjects]);

  return (
    <GlassCard className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="eyebrow">Study hours, last {range} days</p>
        <div className="flex gap-1 rounded-full bg-ink/[0.04] p-1" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === r ? 'bg-accent text-white' : 'text-ink-muted'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {totalMs === 0 ? (
        <EmptyState
          title="No study time in this period"
          description="Sessions from the Study tab appear here, stacked by subject."
          icon={Clock}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Total" value={fmt(totalMs)} />
            <Stat label="Daily avg" value={fmt(totalMs / range)} />
            <Stat label={`Best day${bestDay ? ` · ${bestDay.label}` : ''}`} value={fmt(bestDay?.totalMs ?? 0)} />
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={c.border} vertical={false} />
              <XAxis
                dataKey="label"
                stroke={c.faint}
                fontSize={11}
                tickLine={false}
                interval={range === 7 ? 0 : range === 14 ? 1 : 4}
              />
              <YAxis
                stroke={c.faint}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(v: number) => `${+v.toFixed(1)}h`}
              />
              <Tooltip
                cursor={{ fill: c.border, opacity: 0.4 }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as DayRow | undefined;
                  if (!active || !row) return null;
                  const entries = Object.entries(row.bySubject).sort((a, b) => b[1] - a[1]);
                  return (
                    <div
                      style={{
                        background: c.surface,
                        border: `1px solid ${c.border}`,
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 12,
                        color: c.ink
                      }}
                    >
                      <p style={{ fontWeight: 600, marginBottom: entries.length ? 4 : 0 }}>
                        {row.label} · {row.totalMs > 0 ? fmt(row.totalMs) : 'No study'}
                      </p>
                      {entries.map(([id, ms]) => (
                        <p key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: subjectColor.get(id) ?? c.accent
                            }}
                          />
                          {subjectName.get(id) ?? 'Subject'}: {fmt(ms)}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {subjectTotals.map((t) => (
                <Bar key={t.subject.id} dataKey={t.subject.id} stackId="study" fill={t.subject.color} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>

          <p className="mt-2 text-xs text-ink-muted">
            Studied on {activeDays} of {range} days.
          </p>

          <ul className="mt-4 space-y-3">
            {subjectTotals.map((t) => (
              <li key={t.subject.id}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-ink">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.subject.color }} />
                    <span className="truncate">{t.subject.name}</span>
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {fmt(t.ms)} · {Math.round((t.ms / totalMs) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(t.ms / totalMs) * 100}%`, background: t.subject.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-ink/[0.04] px-3 py-2">
      <p className="eyebrow truncate">{label}</p>
      <p className="mt-1 font-serif text-2xl leading-none tracking-tight text-ink">{value}</p>
    </div>
  );
}
