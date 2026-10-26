import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/Badge';
import { toISODate, parseISODate } from '@/lib/dates';
import { useChartColors } from '@/lib/chartTheme';
import type { Task } from '@/types';

interface DayPoint {
  date: string;
  label: string;
  percent: number;
  total: number;
  completed: number;
}

const DAYS_BACK = 14;
/** Height of the stub drawn for a day that has tasks but none finished. */
const ZERO_STUB = 3;

export function TaskCompletionTrendChart({ tasks }: { tasks: Task[] }) {
  const c = useChartColors();
  const today = new Date();
  const byDate = new Map<string, { total: number; completed: number }>();

  for (const t of tasks) {
    if (!t.date) continue;
    const entry = byDate.get(t.date) ?? { total: 0, completed: 0 };
    entry.total++;
    if (t.status === 'completed') entry.completed++;
    byDate.set(t.date, entry);
  }

  const points: DayPoint[] = [];
  for (let i = DAYS_BACK - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = toISODate(d);
    const entry = byDate.get(iso);
    points.push({
      date: iso,
      label: `${parseISODate(iso).getMonth() + 1}/${parseISODate(iso).getDate()}`,
      percent: entry && entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0,
      total: entry?.total ?? 0,
      completed: entry?.completed ?? 0
    });
  }

  const hasAnyData = points.some((p) => p.total > 0);
  const completedInRange = points.reduce((sum, p) => sum + p.completed, 0);

  return (
    <GlassCard className="p-4">
      <p className="eyebrow mb-4">Task completion, last {DAYS_BACK} days</p>
      {!hasAnyData ? (
        <EmptyState
          title="No dated tasks yet"
          description="Tasks with a date will show your day-by-day completion rate here."
          icon={BarChart3}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={c.border} vertical={false} />
              <XAxis dataKey="label" stroke={c.faint} fontSize={11} tickLine={false} interval={1} />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                stroke={c.faint}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip
                cursor={{ fill: c.border, opacity: 0.4 }}
                formatter={(_value: number, _name: unknown, item: unknown) => {
                  const p = (item as { payload?: DayPoint } | undefined)?.payload;
                  if (!p || p.total === 0) return ['No tasks', 'Completed'];
                  return [`${p.completed} of ${p.total} (${p.percent}%)`, 'Completed'];
                }}
                contentStyle={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: c.ink
                }}
              />
              <Bar
                dataKey="percent"
                shape={(props: unknown) => {
                  const { x, y, width, height, payload } = props as {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    payload: DayPoint;
                  };
                  if (payload.total === 0) return <g />;
                  // Days with tasks but nothing done get a thin stub, so they
                  // read as "0%" rather than "no data".
                  if (payload.percent === 0) {
                    return <rect x={x} y={y - ZERO_STUB} width={width} height={ZERO_STUB} rx={1.5} fill={c.rose} opacity={0.6} />;
                  }
                  return <rect x={x} y={y} width={width} height={height} rx={3} fill={c.forest} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
          {completedInRange === 0 && (
            <p className="mt-3 text-sm text-ink-muted">No tasks completed in this period yet.</p>
          )}
        </>
      )}
    </GlassCard>
  );
}
