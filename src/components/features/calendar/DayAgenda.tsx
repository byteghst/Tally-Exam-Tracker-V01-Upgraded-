import { Link } from 'react-router-dom';
import { ChevronRight, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { CheckButton, StrikeText } from '@/components/motion/Check';
import type { Exam, ExamType, Task } from '@/types';

interface DayAgendaProps {
  exams: Exam[];
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task) => void;
}

const TYPE_DOT: Record<ExamType, string> = {
  daily: 'bg-accent',
  weekly: 'bg-saffron',
  monthly: 'bg-forest'
};

export function DayAgenda({ exams, tasks, onToggleTask, onEditTask }: DayAgendaProps) {
  const isEmpty = exams.length === 0 && tasks.length === 0;

  if (isEmpty) {
    return (
      <div>
        <p className="font-serif text-4xl leading-none tracking-tight text-ink">Nothing on this day.</p>
        <p className="mt-3 text-sm text-ink-muted">Exams and tasks for the selected date will show up here.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {exams.map((exam) => (
        <li key={exam.id}>
          <Link to={`/exams/${exam.id}`} className="group flex items-center gap-3 py-3 transition-colors hover:bg-ink/5">
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

      {tasks.map((task) => {
        const done = task.status === 'completed';
        return (
          <li key={task.id} className="flex items-center gap-3 py-3">
            <CheckButton
              checked={done}
              onToggle={() => onToggleTask(task.id)}
              label={`Mark "${task.name}" ${done ? 'incomplete' : 'complete'}`}
            />
            <StrikeText done={done} className="block min-w-0 flex-1 truncate text-base">
              {task.name}
            </StrikeText>
            <button
              onClick={() => onEditTask(task)}
              aria-label={`Edit ${task.name}`}
              className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
            >
              <Pencil size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
