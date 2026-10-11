import { useEffect, useState } from 'react';
import { Pencil, Trash2, Repeat, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Rise, Section, Stagger } from '@/components/motion/Reveal';
import { CheckButton, StrikeText } from '@/components/motion/Check';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { useTaskStore } from '@/store/taskStore';
import { useOpenAddFromNavState } from '@/hooks/useOpenAddFromNavState';
import { parseISODate, todayISO } from '@/lib/dates';
import type { Task } from '@/types';

// Priority shows as a small coloured dot: high = crimson, medium = saffron, low = forest.
const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-saffron',
  low: 'bg-forest'
};

export function Tasks() {
  const { tasks, hydrate, toggleComplete, deleteTask } = useTaskStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>(undefined);

  useOpenAddFromNavState(() => {
    setEditing(undefined);
    setFormOpen(true);
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const today = tasks.filter((t) => t.date === todayISO());
  const upcoming = tasks
    .filter((t) => t.date && t.date > todayISO())
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const todayDone = today.filter((t) => t.status === 'completed').length;

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setFormOpen(true);
  }

  return (
    <Stagger className="space-y-10 py-8">
      <Rise as="header" className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">To do</p>
          <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Tasks</h1>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </Rise>

      <Section
        label="Today"
        aside={
          today.length > 0 ? (
            <span className="font-numeric text-sm tabular-nums text-ink-muted">
              {todayDone} of {today.length}
            </span>
          ) : undefined
        }
      >
        {today.length === 0 ? (
          <div>
            <p className="font-serif text-4xl leading-none tracking-tight text-ink">You're clear.</p>
            <p className="mt-3 text-sm text-ink-muted">Nothing needs your attention today.</p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={openAdd}>
              Add a task
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {today.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleComplete(task.id)}
                onEdit={() => openEdit(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </ul>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section label="Upcoming">
          <ul className="divide-y divide-border">
            {upcoming.slice(0, 15).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showDate
                onToggle={() => toggleComplete(task.id)}
                onEdit={() => openEdit(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </ul>
        </Section>
      )}

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
    </Stagger>
  );
}

function TaskRow({
  task,
  showDate,
  onToggle,
  onEdit,
  onDelete
}: {
  task: Task;
  showDate?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === 'completed';
  const priorityDot = PRIORITY_DOT[String(task.priority)] ?? 'bg-ink-faint';
  return (
    <li className="flex items-center gap-3 py-3">
      <CheckButton
        checked={done}
        onToggle={onToggle}
        label={`Mark "${task.name}" ${done ? 'incomplete' : 'complete'}`}
      />
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', priorityDot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <StrikeText done={done} className="block truncate text-base">
          {task.name}
        </StrikeText>
        {showDate && task.date && (
          <p className="mt-0.5 text-xs text-ink-muted">
            {parseISODate(task.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>
      {task.recurrence && <Repeat size={14} className="shrink-0 text-ink-faint" aria-label="Repeating task" />}
      <button
        onClick={onEdit}
        aria-label={`Edit ${task.name}`}
        className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
      >
        <Pencil size={16} />
      </button>
      <button
        onClick={onDelete}
        aria-label={`Delete ${task.name}`}
        className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
