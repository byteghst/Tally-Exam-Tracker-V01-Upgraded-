import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/Badge';
import { toISODate, parseISODate } from '@/lib/dates';
import type { Task } from '@/types';

interface DayPoint {
  date: string;
  label: string;
  percent: number;
  total: number;
}

const DAYS_BACK = 14;

export function TaskCompletionTrendChart({ tasks }: { tasks: Task[] }) {
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
      total: entry?.total ?? 0
    });
  }

  const hasAnyData = points.some((p) => p.total > 0);

  return (
    <GlassCard className="p-4">
      <p className="mb-3 text-sm font-medium text-ink-muted">Task completion — last {DAYS_BACK} days</p>
      {!hasAnyData ? (
        <EmptyState
          title="No dated tasks yet"
          description="Tasks with a date will show your day-by-day completion rate here."
          icon={BarChart3}
        />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={points} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" stroke="#9EA7B8" fontSize={11} tickLine={false} interval={1} />
            <YAxis domain={[0, 100]} stroke="#9EA7B8" fontSize={12} tickLine={false} width={36} />
            <Tooltip
              formatter={(value: number, _name: unknown, item: unknown) => {
                const entry = item as { payload?: { total?: number } } | undefined;
                const total = entry?.payload?.total ?? 0;
                return [`${value}% (${total} task${total === 1 ? '' : 's'})`, 'Completed'];
              }}
              contentStyle={{
                background: '#141B2B',
                border: '1px solid #262F42',
                borderRadius: 8,
                fontSize: 12
              }}
            />
            <Bar dataKey="percent" fill="#3EBD7E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  );
}
