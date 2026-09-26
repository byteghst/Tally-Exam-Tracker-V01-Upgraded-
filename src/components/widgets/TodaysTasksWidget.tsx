import { PartyPopper } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCountUp } from '@/hooks/useCountUp';
import type { Task } from '@/types';

interface TodaysTasksWidgetProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onAddTask: () => void;
}

export function TodaysTasksWidget({ tasks, onToggle, onAddTask }: TodaysTasksWidgetProps) {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const animatedCompleted = useCountUp(completed, 400);

  return (
    <GlassCard className="p-5">
      <p className="text-sm font-medium text-ink-muted">Today's tasks</p>
      {tasks.length === 0 ? (
        <EmptyState
          title="You're clear"
          description="Nothing needs your attention today."
          icon={PartyPopper}
          action={
            <Button size="sm" variant="secondary" onClick={onAddTask}>
              Add task
            </Button>
          }
        />
      ) : (
        <>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
            {animatedCompleted}/{tasks.length}
          </p>
          <ProgressBar value={(completed / tasks.length) * 100} className="mt-3" />
          <ul className="mt-4 space-y-2">
            {tasks.slice(0, 4).map((task) => (
              <li key={task.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  onChange={() => onToggle(task.id)}
                  aria-label={`Mark "${task.name}" ${task.status === 'completed' ? 'incomplete' : 'complete'}`}
                  className="h-4 w-4 rounded accent-accent transition-transform duration-150 active:scale-90"
                />
                <span
                  className={`transition-colors duration-300 ${
                    task.status === 'completed' ? 'text-ink-faint line-through' : 'text-ink'
                  }`}
                >
                  {task.name}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </GlassCard>
  );
}
