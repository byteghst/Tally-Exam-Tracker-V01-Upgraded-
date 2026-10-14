import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Segmented } from '@/components/ui/Segmented';
import { ToggleRow } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { taskFormSchema, type TaskFormValues } from '@/lib/validation/taskSchema';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import { todayISO } from '@/lib/dates';
import { EASE_OUT } from '@/lib/motion';
import { newSubtask, statusFromSubtasks } from '@/lib/subtasks';
import type { Subtask, Task, TaskPriority, TaskStatus, RecurrenceFreq } from '@/types';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  task?: Task;
}

type FieldErrors = Record<string, string | undefined>;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Priority colours match the dots on the Tasks screen.
const PRIORITY_OPTIONS = [
  { value: 'low' as TaskPriority, label: 'Low', color: 'bg-forest' },
  { value: 'medium' as TaskPriority, label: 'Medium', color: 'bg-saffron' },
  { value: 'high' as TaskPriority, label: 'High', color: 'bg-danger' }
];

const FREQ_OPTIONS = [
  { value: 'daily' as RecurrenceFreq, label: 'Daily' },
  { value: 'weekdays' as RecurrenceFreq, label: 'Weekdays' },
  { value: 'weekly' as RecurrenceFreq, label: 'Weekly' },
  { value: 'custom' as RecurrenceFreq, label: 'Custom' }
];

function toFormState(task?: Task) {
  return {
    name: task?.name ?? '',
    date: task?.date ?? todayISO(),
    time: task?.time ?? '',
    estimatedDuration: task?.estimatedDuration?.toString() ?? '',
    priority: task?.priority ?? ('medium' as TaskPriority),
    category: task?.category ?? '',
    reminderMinutesBefore: task?.reminderMinutesBefore?.toString() ?? '',
    notes: task?.notes ?? '',
    subtasks: (task?.subtasks ?? []) as Subtask[],
    subtaskDraft: '',
    recurrenceEnabled: !!task?.recurrence,
    recurrenceFreq: task?.recurrence?.freq ?? ('daily' as RecurrenceFreq),
    recurrenceDays: task?.recurrence?.daysOfWeek ?? ([] as number[]),
    recurrenceEndDate: task?.recurrence?.endDate ?? ''
  };
}

export function TaskForm({ open, onClose, task }: TaskFormProps) {
  const { addTask, updateTask } = useTaskStore();
  const { pushToast } = useUIStore();
  const isEdit = !!task;

  const [form, setForm] = useState(() => toFormState(task));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastId, setLastId] = useState(task?.id);

  if (task?.id !== lastId || (!task && lastId)) {
    setLastId(task?.id);
    setForm(toFormState(task));
    setErrors({});
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      recurrenceDays: f.recurrenceDays.includes(day)
        ? f.recurrenceDays.filter((d) => d !== day)
        : [...f.recurrenceDays, day].sort()
    }));
  }

  function addSubtask() {
    const name = form.subtaskDraft.trim();
    if (!name) return;
    setForm((f) => ({ ...f, subtasks: [...f.subtasks, newSubtask(name)], subtaskDraft: '' }));
  }

  function removeSubtask(id: string) {
    setForm((f) => ({ ...f, subtasks: f.subtasks.filter((s) => s.id !== id) }));
  }

  async function handleSubmit() {
    const toValidate: TaskFormValues = {
      name: form.name,
      date: form.date,
      time: form.time,
      estimatedDuration: form.estimatedDuration === '' ? '' : Number(form.estimatedDuration),
      priority: form.priority,
      category: form.category,
      reminderMinutesBefore: form.reminderMinutesBefore === '' ? '' : Number(form.reminderMinutesBefore),
      notes: form.notes,
      recurrenceEnabled: form.recurrenceEnabled,
      recurrence: form.recurrenceEnabled
        ? {
            freq: form.recurrenceFreq,
            daysOfWeek: form.recurrenceDays,
            endDate: form.recurrenceEndDate || undefined
          }
        : undefined
    };

    const result = taskFormSchema.safeParse(toValidate);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const v = result.data;

    // Whatever is still typed in the subtask box is kept rather than lost.
    const draft = form.subtaskDraft.trim();
    const subtasks: Subtask[] = draft ? [...form.subtasks, newSubtask(draft)] : form.subtasks;
    const baseStatus: TaskStatus = task?.status ?? 'todo';

    const payload = {
      name: v.name.trim(),
      date: v.date,
      time: v.time || undefined,
      estimatedDuration: v.estimatedDuration === '' ? undefined : v.estimatedDuration,
      priority: v.priority,
      category: v.category?.trim() || undefined,
      reminderMinutesBefore: v.reminderMinutesBefore === '' ? undefined : v.reminderMinutesBefore,
      notes: v.notes?.trim() || undefined,
      subtasks,
      // a task with subtasks is complete exactly when all of them are done
      status: statusFromSubtasks(subtasks, baseStatus),
      recurrence: v.recurrenceEnabled ? v.recurrence : undefined,
      seriesId: task?.seriesId
    };

    try {
      if (isEdit && task) {
        await updateTask(task.id, payload);
        pushToast('Task updated');
      } else {
        await addTask(payload);
        pushToast(v.recurrenceEnabled ? 'Recurring task added' : 'Task added');
      }
      onClose();
    } catch {
      pushToast('Something went wrong saving this task. Please try again.', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit task' : 'Add task'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {isEdit ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Input
          label="Task name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder="e.g. Revise Chapter 4 problems"
        />

        <div>
          <p className="eyebrow">Subtasks</p>
          {form.subtasks.length > 0 && (
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {form.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className={clsx('h-2 w-2 shrink-0 rounded-full', s.done ? 'bg-forest' : 'bg-ink/25')} />
                  <span className={clsx('min-w-0 flex-1 truncate text-base', s.done && 'text-ink-faint line-through')}>
                    {s.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubtask(s.id)}
                    aria-label={`Remove subtask ${s.name}`}
                    className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={form.subtaskDraft}
                onChange={(e) => set('subtaskDraft', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add a subtask"
                aria-label="New subtask"
              />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addSubtask} className="mb-1.5">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            The task's progress bar fills as you finish subtasks, and the task completes when the last one is done.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            error={errors.date}
          />
          <Input
            label="Time (optional)"
            type="time"
            value={form.time}
            onChange={(e) => set('time', e.target.value)}
          />
        </div>

        <Segmented
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={form.priority}
          onChange={(p) => set('priority', p)}
        />

        <div className="grid grid-cols-2 gap-5">
          <Input
            label="Duration (min)"
            type="number"
            inputMode="numeric"
            value={form.estimatedDuration}
            onChange={(e) => set('estimatedDuration', e.target.value)}
            error={errors.estimatedDuration}
          />
          <Input
            label="Reminder (min before)"
            type="number"
            inputMode="numeric"
            value={form.reminderMinutesBefore}
            onChange={(e) => set('reminderMinutesBefore', e.target.value)}
            error={errors.reminderMinutesBefore}
          />
        </div>

        <Input
          label="Category (optional)"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
          error={errors.category}
        />

        <div className="border-y border-border">
          <ToggleRow
            label="Repeat this task"
            checked={form.recurrenceEnabled}
            onChange={(checked) => set('recurrenceEnabled', checked)}
          />

          <AnimatePresence initial={false}>
            {form.recurrenceEnabled && (
              <motion.div
                key="recurrence"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="space-y-5 pb-5 pt-1">
                  <Segmented options={FREQ_OPTIONS} value={form.recurrenceFreq} onChange={(f) => set('recurrenceFreq', f)} />

                  {(form.recurrenceFreq === 'weekly' || form.recurrenceFreq === 'custom') && (
                    <div>
                      <div className="flex justify-between gap-1">
                        {DAY_LABELS.map((label, i) => {
                          const on = form.recurrenceDays.includes(i);
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => toggleDay(i)}
                              aria-pressed={on}
                              className={clsx(
                                'h-10 flex-1 rounded-control border text-xs font-semibold transition-colors duration-200',
                                on ? 'border-ink bg-ink text-surface' : 'border-ink/20 text-ink-muted hover:text-ink'
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {errors['recurrence.daysOfWeek'] && (
                        <p className="mt-1 text-sm text-danger">{errors['recurrence.daysOfWeek']}</p>
                      )}
                    </div>
                  )}

                  <Input
                    label="Ends on (optional)"
                    type="date"
                    value={form.recurrenceEndDate}
                    onChange={(e) => set('recurrenceEndDate', e.target.value)}
                  />
                  <p className="text-xs text-ink-faint">
                    Upcoming instances are generated automatically up to 60 days ahead.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} error={errors.notes} />
      </div>
    </Sheet>
  );
}
