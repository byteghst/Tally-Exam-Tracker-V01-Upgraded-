import { Link } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { MissionItem } from '@/lib/dailyMission';

const ITEM_PATH: Record<string, string> = {
  tasks: '/tasks',
  'record-results': '/exams'
};

export function DailyMission({ items, onDismiss }: { items: MissionItem[]; onDismiss: () => void }) {
  if (items.length === 0) return null;

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink-muted">Today's mission</p>
          {allDone && <p className="text-sm font-semibold text-success">Mission complete.</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-ink-faint">
            {doneCount} / {items.length}
          </span>
          <button
            onClick={onDismiss}
            aria-label="Dismiss today's mission"
            className="rounded-control p-1 text-ink-faint hover:bg-white/5 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={ITEM_PATH[item.id] ?? '/dashboard'}
              className="flex items-center gap-2.5 rounded-control px-1 py-1 hover:bg-white/5"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                  item.done ? 'border-success bg-success/15 text-success' : 'border-border text-transparent'
                }`}
              >
                <Check size={12} />
              </span>
              <span className={`text-sm transition-colors duration-300 ${item.done ? 'text-ink-faint line-through' : 'text-ink'}`}>
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
