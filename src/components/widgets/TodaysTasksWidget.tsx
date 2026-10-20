import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/motion/Reveal';
import { CheckButton, StrikeText } from '@/components/motion/Check';
import { useCountUp } from '@/hooks/useCountUp';
import { EASE_OUT } from '@/lib/motion';
import { subtaskProgress } from '@/lib/subtasks';
import type { Task } from '@/types';

interface TodaysTasksWidgetProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onAddTask: () => void;
}

export function TodaysTasksWidget({ tasks, onToggle, onAddTask }: TodaysTasksWidgetProps) {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const animatedCompleted = useCountUp(completed, 700);
  const pct = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

  return (
    <Section label="Today's tasks" card>
      {tasks.length === 0 ? (
        <div>
          <p className="font-serif text-4xl leading-none tracking-tight text-ink">You're clear.</p>
          <p className="mt-3 text-sm text-ink-muted">Nothing needs your attention today.</p>
          <Button size="sm" variant="secondary" className="mt-4" onClick={onAddTask}>
            Add task
          </Button>
        </div>
      ) : (
        <>
          <p className="font-serif text-6xl leading-none tracking-tight text-ink">
            {animatedCompleted}
            <span className="text-ink-faint">/{tasks.length}</span>
          </p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.3 }}
            />
          </div>
          <ul className="mt-4 space-y-1.5">
            {tasks.slice(0, 4).map((task) => {
              const done = task.status === 'completed';
              const sub = subtaskProgress(task);
              return (
                <li key={task.id} className="flex items-center gap-3 rounded-control bg-ink/[0.04] px-3 py-2.5">
                  <CheckButton
                    checked={done}
                    onToggle={() => onToggle(task.id)}
                    label={`Mark "${task.name}" ${done ? 'incomplete' : 'complete'}`}
                  />
                  <StrikeText done={done} className="min-w-0 flex-1 truncate text-base">
                    {task.name}
                  </StrikeText>
                  {sub && (
                    <span className="shrink-0 font-numeric text-xs tabular-nums text-ink-muted">
                      {sub.done}/{sub.total}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}
