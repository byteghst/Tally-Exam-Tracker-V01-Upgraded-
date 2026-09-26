import { useEffect, useState } from 'react';
import { Pencil, Trash2, Repeat, PartyPopper } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { useTaskStore } from '@/store/taskStore';
import { useOpenAddFromNavState } from '@/hooks/useOpenAddFromNavState';
import { todayISO } from '@/lib/dates';
import type { Task } from '@/types';

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

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Tasks</h1>
        <Button size="sm" onClick={openAdd}>
          Add task
        </Button>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-muted">Today</h2>
        {today.length === 0 ? (
          <EmptyState
            title="You're clear"
            description="Nothing needs your attention today."
            icon={PartyPopper}
            action={
              <Button size="sm" onClick={openAdd}>
                Add a task
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {today.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleComplete(task.id)}
                onEdit={() => openEdit(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-muted">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.slice(0, 15).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleComplete(task.id)}
                onEdit={() => openEdit(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        </section>
      )}

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === 'completed';
  return (
    <GlassCard className="flex items-center gap-3 p-3.5">
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        aria-label={`Mark "${task.name}" ${done ? 'incomplete' : 'complete'}`}
        className="h-4 w-4 shrink-0 rounded accent-accent transition-transform duration-150 active:scale-90"
      />
      <span
        className={`min-w-0 flex-1 truncate transition-colors duration-300 ${
          done ? 'text-ink-faint line-through' : 'text-ink'
        }`}
      >
        {task.name}
      </span>
      {task.recurrence && <Repeat size={14} className="shrink-0 text-ink-faint" aria-label="Repeating task" />}
      <button
        onClick={onEdit}
        aria-label={`Edit ${task.name}`}
        className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink"
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
    </GlassCard>
  );
}
