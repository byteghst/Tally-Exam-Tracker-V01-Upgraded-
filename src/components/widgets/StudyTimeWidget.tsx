import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useStudyStore, elapsedMs } from '@/store/studyStore';

function formatShort(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return ms > 0 ? '<1m' : '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Today's study time, broken down by subject. Recomputed live: while a
 * timer is running, its elapsed time (derived from timestamps, not a
 * ticking counter — see studyStore) counts toward today's total even
 * though nothing here re-renders every second; the numbers are correct
 * the moment this widget is shown, which is enough for a dashboard summary.
 */
export function StudyTimeWidget() {
  const subjects = useStudyStore((s) => s.subjects);
  const sessions = useStudyStore((s) => s.sessions);
  const active = useStudyStore((s) => s.active);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayFrom = dayStart.getTime();

  const byId: Record<string, number> = {};
  for (const s of sessions) {
    if (s.end >= todayFrom) byId[s.subjectId] = (byId[s.subjectId] ?? 0) + s.durationMs;
  }
  if (active && active.sessionStart >= todayFrom) {
    byId[active.subjectId] = (byId[active.subjectId] ?? 0) + elapsedMs(active);
  }

  const rows = subjects
    .map((subject) => ({ subject, ms: byId[subject.id] ?? 0 }))
    .filter((r) => r.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  const total = rows.reduce((sum, r) => sum + r.ms, 0);

  if (rows.length === 0) {
    return (
      <GlassCard className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Study time today</p>
        <EmptyState
          title="Nothing logged yet today"
          description="Start a subject's timer on the Study tab to see it here."
          icon={Timer}
          action={
            <Link to="/study">
              <Button size="sm" variant="secondary">
                Open Study
              </Button>
            </Link>
          }
        />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="space-y-3 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Study time today</p>
        <span className="tabular-nums font-display text-2xl font-bold text-ink">{formatShort(total)}</span>
      </div>

      <div className="space-y-2">
        {rows.slice(0, 4).map(({ subject, ms }) => {
          const pct = total > 0 ? Math.round((ms / total) * 100) : 0;
          return (
            <div key={subject.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate text-ink">{subject.name}</span>
                <span className="tabular-nums shrink-0 pl-2 text-ink-muted">{formatShort(ms)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: subject.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/study" className="inline-block text-sm font-semibold text-accent hover:underline">
        View all subjects
      </Link>
    </GlassCard>
  );
}
