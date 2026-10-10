import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/motion/Reveal';
import { EASE_OUT } from '@/lib/motion';
import { toneColor } from '@/lib/palette';
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
      <Section label="Study time today">
        <p className="font-serif text-4xl leading-none tracking-tight text-ink">Nothing yet.</p>
        <p className="mt-3 text-sm text-ink-muted">Start a subject's timer on the Study tab to see it here.</p>
        <Link to="/study" className="mt-4 inline-block">
          <Button size="sm" variant="secondary">
            Open Study
          </Button>
        </Link>
      </Section>
    );
  }

  return (
    <Section label="Study time today">
      <p className="font-serif text-6xl leading-none tracking-tight text-ink">{formatShort(total)}</p>

      <div className="mt-6 space-y-4">
        {rows.slice(0, 4).map(({ subject, ms }, i) => {
          const pct = total > 0 ? Math.round((ms / total) * 100) : 0;
          return (
            <div key={subject.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate text-ink">{subject.name}</span>
                <span className="shrink-0 pl-2 font-numeric tabular-nums text-ink-muted">{formatShort(ms)}</span>
              </div>
              <div className="h-0.5 w-full overflow-hidden bg-border">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: toneColor(subject.color) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.35 + i * 0.08 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/study" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">
        View all subjects
      </Link>
    </Section>
  );
}
