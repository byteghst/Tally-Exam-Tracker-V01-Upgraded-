import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { CheckButton, StrikeText } from '@/components/motion/Check';
import { EASE_OUT } from '@/lib/motion';
import { subtaskProgress } from '@/lib/subtasks';
import type { Exam, ExamType, Task } from '@/types';

interface DayAgendaProps {
  exams: Exam[];
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onEditTask: (task: Task) => void;
}

const TYPE_DOT: Record<ExamType, string> = {
  daily: 'bg-accent',
  weekly: 'bg-saffron',
  monthly: 'bg-forest'
};

export function DayAgenda({ exams, tasks, onToggleTask, onToggleSubtask, onEditTask }: DayAgendaProps) {
  const isEmpty = exams.length === 0 && tasks.length === 0;

  if (isEmpty) {
    return (
      <GlassCard className="p-5">
        <p className="font-serif text-4xl leading-none tracking-tight text-ink">Nothing on this day.</p>
        <p className="mt-3 text-sm text-ink-muted">Exams and tasks for the selected date will show up here.</p>
      </GlassCard>
    );
  }

  return (
    <ul className="space-y-2">
      {exams.map((exam) => (
        <li key={exam.id}>
          <Link
            to={`/exams/${exam.id}`}
            className="group flex items-center gap-3 rounded-card bg-surface-raised px-3 py-3 shadow-soft transition-shadow hover:shadow-raise"
          >
            <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', TYPE_DOT[exam.type])} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base text-ink">{exam.name}</p>
              <p className="text-xs capitalize text-ink-muted">{exam.type} exam</p>
            </div>
            <ChevronRight
              size={18}
              className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </li>
      ))}

      {tasks.map((task) => (
        <AgendaTask
          key={task.id}
          task={task}
          onToggle={() => onToggleTask(task.id)}
          onToggleSubtask={(subtaskId) => onToggleSubtask(task.id, subtaskId)}
          onEdit={() => onEditTask(task)}
        />
      ))}
    </ul>
  );
}

/**
 * One task on the selected day. Works for any date, past ones included: the
 * task can be ticked or un-ticked, and so can each of its subtasks (shown
 * open by default so past days can be corrected quickly).
 */
function AgendaTask({
  task,
  onToggle,
  onToggleSubtask,
  onEdit
}: {
  task: Task;
  onToggle: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onEdit: () => void;
}) {
  const done = task.status === 'completed';
  const progress = subtaskProgress(task);
  const [expanded, setExpanded] = useState(true);

  return (
    <li className="rounded-card bg-surface-raised px-3 py-3 shadow-soft">
      <div className="flex items-center gap-3">
        <CheckButton
          checked={done}
          onToggle={onToggle}
          label={`Mark "${task.name}" ${done ? 'incomplete' : 'complete'}`}
        />
        <StrikeText done={done} className="block min-w-0 flex-1 truncate text-base">
          {task.name}
        </StrikeText>
        {progress && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} subtasks of ${task.name}`}
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-ink/[0.06] px-2 py-1 font-numeric text-xs tabular-nums text-ink-muted hover:bg-ink/10"
          >
            {progress.done}/{progress.total}
            <ChevronDown size={14} className={clsx('transition-transform duration-300', expanded && 'rotate-180')} />
          </button>
        )}
        <button
          onClick={onEdit}
          aria-label={`Edit ${task.name}`}
          className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          <Pencil size={16} />
        </button>
      </div>

      {progress && (
        <div className="mt-2.5 pl-9">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className={clsx('h-full rounded-full', progress.percent === 100 ? 'bg-forest' : 'bg-accent')}
              initial={false}
              animate={{ width: `${progress.percent}%` }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            />
          </div>

          <div
            className={clsx(
              'grid transition-[grid-template-rows] duration-300 ease-out',
              expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
          >
            <ul aria-hidden={!expanded} className="min-h-0 overflow-hidden">
              {(task.subtasks ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <CheckButton
                    checked={s.done}
                    onToggle={() => onToggleSubtask(s.id)}
                    label={`Mark subtask "${s.name}" ${s.done ? 'incomplete' : 'complete'}`}
                  />
                  <StrikeText done={s.done} className="block min-w-0 flex-1 truncate text-base">
                    {s.name}
                  </StrikeText>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
