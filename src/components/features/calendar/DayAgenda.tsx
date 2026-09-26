import { Link } from 'react-router-dom';
import { FileSpreadsheet, ListChecks, Pencil, CalendarX2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge, EmptyState } from '@/components/ui/Badge';
import type { Exam, Task } from '@/types';

interface DayAgendaProps {
  exams: Exam[];
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task) => void;
}

export function DayAgenda({ exams, tasks, onToggleTask, onEditTask }: DayAgendaProps) {
  const isEmpty = exams.length === 0 && tasks.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        title="Nothing on this day"
        description="Exams and tasks for the selected date will show up here."
        icon={CalendarX2}
      />
    );
  }

  return (
    <div className="space-y-2">
      {exams.map((exam) => (
        <Link key={exam.id} to={`/exams/${exam.id}`}>
          <GlassCard interactive className="flex items-center gap-3 p-3.5">
            <FileSpreadsheet size={18} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-ink">{exam.name}</span>
            <Badge tone={exam.type === 'daily' ? 'accent' : 'neutral'}>{exam.type}</Badge>
          </GlassCard>
        </Link>
      ))}

      {tasks.map((task) => (
        <GlassCard key={task.id} className="flex items-center gap-3 p-3.5">
          <input
            type="checkbox"
            checked={task.status === 'completed'}
            onChange={() => onToggleTask(task.id)}
            aria-label={`Mark "${task.name}" ${task.status === 'completed' ? 'incomplete' : 'complete'}`}
            className="h-4 w-4 shrink-0 rounded accent-accent"
          />
          <ListChecks size={16} className="shrink-0 text-success" />
          <span
            className={`min-w-0 flex-1 truncate ${
              task.status === 'completed' ? 'text-ink-faint line-through' : 'text-ink'
            }`}
          >
            {task.name}
          </span>
          <button
            onClick={() => onEditTask(task)}
            aria-label={`Edit ${task.name}`}
            className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink"
          >
            <Pencil size={16} />
          </button>
        </GlassCard>
      ))}
    </div>
  );
}
