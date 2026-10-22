import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, Repeat, Plus, ChevronDown, Share2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageLoader } from '@/components/ui/PageLoader';
import { Rise, Section, Stagger } from '@/components/motion/Reveal';
import { CheckButton, StrikeText } from '@/components/motion/Check';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { ShareTaskCard } from '@/components/features/tasks/ShareTaskCard';
import { useTaskStore } from '@/store/taskStore';
import { useOpenAddFromNavState } from '@/hooks/useOpenAddFromNavState';
import { isFirstLoad } from '@/lib/firstLoad';
import { parseISODate, todayISO } from '@/lib/dates';
import { EASE_OUT } from '@/lib/motion';
import { subtaskProgress } from '@/lib/subtasks';
import type { Task } from '@/types';

// Priority shows as a small coloured dot: high = crimson, medium = saffron, low = forest.
const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-saffron',
  low: 'bg-forest'
};

export function Tasks() {
  const { tasks, hydrate, toggleComplete, toggleSubtask, deleteTask } = useTaskStore();
  const firstLoad = useTaskStore(isFirstLoad);
  const [formOpen, setFormOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
    <Stagger className="space-y-8 py-8">
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
          <div className="flex items-center gap-3">
            {today.length > 0 && (
              <span className="font-numeric text-sm tabular-nums text-ink-muted">
                {todayDone} of {today.length}
              </span>
            )}
            {/* Share is always there: it also makes yesterday's and the week's cards */}
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-accent"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        }
      >
        {today.length === 0 ? (
          firstLoad ? (
            <PageLoader label="Loading tasks" />
          ) : (
            <GlassCard className="p-5">
              <p className="font-serif text-4xl leading-none tracking-tight text-ink">You're clear.</p>
              <p className="mt-3 text-sm text-ink-muted">Nothing needs your attention today.</p>
              <Button size="sm" variant="secondary" className="mt-4" onClick={openAdd}>
                Add a task
              </Button>
            </GlassCard>
          )
        ) : (
          <ul className="space-y-2">
            {today.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleComplete(task.id)}
                onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                onEdit={() => openEdit(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </ul>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section label="Upcoming">
          <ul className="space-y-2">
            {upcoming.slice(0, 15).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showDate
                onToggle={() => toggleComplete(task.id)}
                onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                onEdit={() => openEdit(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </ul>
        </Section>
      )}

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
      <ShareTaskCard open={shareOpen} onClose={() => setShareOpen(false)} tasks={tasks} />
    </Stagger>
  );
}

function TaskRow({
  task,
  showDate,
  onToggle,
  onToggleSubtask,
  onEdit,
  onDelete
}: {
  task: Task;
  showDate?: boolean;
  onToggle: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === 'completed';
  const priorityDot = PRIORITY_DOT[String(task.priority)] ?? 'bg-ink-faint';
  const progress = subtaskProgress(task);
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-card bg-surface-raised px-3 py-3 shadow-soft">
      <div className="flex items-center gap-3">
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
      </div>

      {progress && (
        <div className="mt-2.5 pl-9">
          {/* the task's own progress bar: it fills as subtasks are finished */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className={clsx('h-full rounded-full', progress.percent === 100 ? 'bg-forest' : 'bg-accent')}
              initial={false}
              animate={{ width: `${progress.percent}%` }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            />
          </div>

          {/* the subtasks, folded away until the count is tapped */}
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
