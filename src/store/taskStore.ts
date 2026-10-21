import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { enqueue, flushOutbox, isNetworkFailure, isOffline, makeId, pendingCount } from '@/lib/outbox';
import { expandRecurrence } from '@/lib/dates';
import { statusFromSubtasks } from '@/lib/subtasks';
import type { Subtask, Task } from '@/types';

interface TaskRow {
  id: string;
  name: string;
  date: string | null;
  time: string | null;
  estimated_duration: number | null;
  actual_duration: number | null;
  priority: Task['priority'];
  status: Task['status'];
  category: string | null;
  notes: string | null;
  subtasks: Subtask[] | null;
  recurrence: Task['recurrence'] | null;
  series_id: string | null;
  reminder_minutes_before: number | null;
  created_at: string;
  updated_at: string;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    date: row.date ?? undefined,
    time: row.time ?? undefined,
    estimatedDuration: row.estimated_duration ?? undefined,
    actualDuration: row.actual_duration ?? undefined,
    priority: row.priority,
    status: row.status,
    category: row.category ?? undefined,
    notes: row.notes ?? undefined,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    recurrence: row.recurrence ?? undefined,
    seriesId: row.series_id ?? undefined,
    reminderMinutesBefore: row.reminder_minutes_before ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  };
}

type TaskPayload = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

function toRow(data: Partial<TaskPayload>) {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.date !== undefined) row.date = data.date ?? null;
  if (data.time !== undefined) row.time = data.time ?? null;
  if (data.estimatedDuration !== undefined) row.estimated_duration = data.estimatedDuration ?? null;
  if (data.actualDuration !== undefined) row.actual_duration = data.actualDuration ?? null;
  if (data.priority !== undefined) row.priority = data.priority;
  if (data.status !== undefined) row.status = data.status;
  if (data.category !== undefined) row.category = data.category ?? null;
  if (data.notes !== undefined) row.notes = data.notes ?? null;
  if (data.subtasks !== undefined) row.subtasks = data.subtasks ?? [];
  if (data.recurrence !== undefined) row.recurrence = data.recurrence ?? null;
  if (data.seriesId !== undefined) row.series_id = data.seriesId ?? null;
  if (data.reminderMinutesBefore !== undefined) row.reminder_minutes_before = data.reminderMinutesBefore ?? null;
  return row;
}

/** A blank row, so a task built on the device has every column the mapper reads. */
const EMPTY_ROW = {
  id: '',
  name: '',
  date: null,
  time: null,
  estimated_duration: null,
  actual_duration: null,
  priority: 'medium',
  status: 'todo',
  category: null,
  notes: null,
  subtasks: [],
  recurrence: null,
  series_id: null,
  reminder_minutes_before: null,
  created_at: '',
  updated_at: ''
} as unknown as TaskRow;

/** The task as it should look after `payload` is applied on top of `base` (offline, no server round-trip). */
function localTask(id: string, base: Task | null, payload: Partial<TaskPayload>): Task {
  const now = new Date().toISOString();
  const row = {
    ...EMPTY_ROW,
    ...(base ? toRow(base) : {}),
    ...toRow(payload),
    id,
    created_at: base ? new Date(base.createdAt).toISOString() : now,
    updated_at: now
  } as unknown as TaskRow;
  return mapTask(row);
}

function horizonISO(): string {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  return horizon.toISOString().slice(0, 10);
}

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  /** true once tasks have been read successfully at least once (an empty list is then genuinely empty). */
  loaded: boolean;
  subscribed: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  addTask: (data: TaskPayload) => Promise<Task | null>;
  /** Ticks or un-ticks a task. For a task with subtasks, all of its subtasks follow. */
  toggleComplete: (id: string) => Promise<void>;
  /** Ticks or un-ticks one subtask; the main task completes when the last one is done. */
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskPayload>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

let channel: ReturnType<typeof supabase.channel> | null = null;

async function ensureRecurringInstances(seriesTask: Task, fromISO: string, toISO: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!seriesTask.recurrence || !seriesTask.date || !userId) return;
  const seriesId = seriesTask.seriesId ?? seriesTask.id;
  const occurrences = expandRecurrence(seriesTask.recurrence, seriesTask.date, fromISO, toISO);

  const { data: existing } = await supabase.from('tasks').select('date').eq('series_id', seriesId);
  const existingDates = new Set((existing ?? []).map((t) => t.date));

  const toCreate = occurrences.filter((d) => !existingDates.has(d) && d !== seriesTask.date);
  if (toCreate.length === 0) return;

  // every generated day starts with the same subtasks, all un-ticked
  const freshSubtasks = (seriesTask.subtasks ?? []).map((s) => ({ ...s, done: false }));

  await supabase.from('tasks').insert(
    toCreate.map((date) => ({
      user_id: userId,
      name: seriesTask.name,
      date,
      time: seriesTask.time ?? null,
      estimated_duration: seriesTask.estimatedDuration ?? null,
      priority: seriesTask.priority,
      status: 'todo',
      category: seriesTask.category ?? null,
      notes: seriesTask.notes ?? null,
      subtasks: freshSubtasks,
      recurrence: seriesTask.recurrence,
      series_id: seriesId,
      reminder_minutes_before: seriesTask.reminderMinutesBefore ?? null
    }))
  );
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  loaded: false,
  subscribed: false,

  hydrate: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      // Send changes made offline first, so the read below can't overwrite them.
      await flushOutbox(userId);
      if (pendingCount(userId) > 0) return;
    }
    set({ loading: true });
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('date', { ascending: true, nullsFirst: false });
    // A failed read (offline, expired session...) must not look like "no tasks":
    // keep what we already have and leave `loaded` as it was, so nothing
    // downstream (such as reminder scheduling) acts on missing data.
    if (error || !data) {
      set({ loading: false });
      return;
    }
    set({ tasks: data.map((r) => mapTask(r as TaskRow)), loading: false, loaded: true });
  },

  subscribe: () => {
    if (get().subscribed) return;
    channel = supabase
      .channel('tasks-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => get().hydrate())
      .subscribe();
    set({ subscribed: true });
  },

  unsubscribe: () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    set({ subscribed: false });
  },

  addTask: async (data) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return null;
    const id = makeId();

    // No connection: show the task now and queue it (and, for a repeating task,
    // its upcoming days) to be sent later.
    const saveOffline = (): Task => {
      const task = localTask(id, null, data);
      const added: Task[] = [task];
      enqueue(userId, { table: 'tasks', kind: 'insert', rowId: id, row: { id, user_id: userId, ...toRow(data) } });
      if (task.recurrence && task.date) {
        const fresh = (task.subtasks ?? []).map((s) => ({ ...s, done: false }));
        const dates = expandRecurrence(task.recurrence, task.date, task.date, horizonISO()).filter((d) => d !== task.date);
        for (const date of dates) {
          const instanceId = makeId();
          const instance: Partial<TaskPayload> = {
            ...data,
            date,
            status: 'todo',
            subtasks: fresh,
            seriesId: id,
            actualDuration: undefined
          };
          added.push(localTask(instanceId, null, instance));
          enqueue(userId, {
            table: 'tasks',
            kind: 'insert',
            rowId: instanceId,
            row: { id: instanceId, user_id: userId, ...toRow(instance) }
          });
        }
      }
      set((s) => ({ tasks: [...s.tasks, ...added] }));
      void flushOutbox(userId);
      return task;
    };
    if (isOffline()) return saveOffline();

    const { data: row, error, status } = await supabase
      .from('tasks')
      .insert({ id, user_id: userId, ...toRow(data) })
      .select()
      .single();
    if (error || !row) {
      if (error && isNetworkFailure(error, status)) return saveOffline();
      useUIStore.getState().pushToast('Could not save the task. Please try again.', undefined, 'error');
      return null;
    }
    const task = mapTask(row as TaskRow);
    if (task.recurrence && task.date) {
      await ensureRecurringInstances(task, task.date, horizonISO());
      await get().hydrate();
      return task;
    }
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  toggleComplete: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const completing = task.status !== 'completed';
    const changes: Partial<TaskPayload> = { status: completing ? 'completed' : 'todo' };
    // Ticking the main task finishes every subtask; un-ticking it clears them,
    // so the two can never disagree.
    if ((task.subtasks ?? []).length > 0) {
      changes.subtasks = (task.subtasks ?? []).map((s) => ({ ...s, done: completing }));
    }
    await get().updateTask(id, changes);
  },

  toggleSubtask: async (taskId, subtaskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const subtasks = (task.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
    await get().updateTask(taskId, { subtasks, status: statusFromSubtasks(subtasks, task.status) });
  },

  updateTask: async (id, changes) => {
    const saveOffline = (): boolean => {
      const userId = useAuthStore.getState().user?.id;
      const existing = get().tasks.find((t) => t.id === id);
      if (!userId || !existing) return false;
      const updatedTask = localTask(id, existing, changes);
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updatedTask : t)) }));
      const patch = toRow(changes);
      if (Object.keys(patch).length > 0) {
        enqueue(userId, { table: 'tasks', kind: 'update', rowId: id, row: patch });
        void flushOutbox(userId);
      }
      return true;
    };
    if (isOffline() && saveOffline()) return;

    const { data: row, error, status } = await supabase.from('tasks').update(toRow(changes)).eq('id', id).select().single();
    if (error || !row) {
      if (error && isNetworkFailure(error, status) && saveOffline()) return;
      useUIStore.getState().pushToast('Could not save the change. Check your connection and try again.', undefined, 'error');
      return;
    }
    const updated = mapTask(row as TaskRow);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));

    if (updated.recurrence && updated.date) {
      await ensureRecurringInstances(updated, updated.date, horizonISO());
      await get().hydrate();
    }
  },

  deleteTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    const removeOffline = (): boolean => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return false;
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      enqueue(userId, { table: 'tasks', kind: 'delete', rowId: id });
      void flushOutbox(userId);
      if (task) useUIStore.getState().pushToast(`Deleted "${task.name}"`);
      return true;
    };
    if (isOffline() && removeOffline()) return;

    const { error, status } = await supabase.from('tasks').delete().eq('id', id);
    // Only drop it from the screen if the delete is saved (or queued); otherwise it
    // would look done and the task would reappear later.
    if (error) {
      if (isNetworkFailure(error, status) && removeOffline()) return;
      useUIStore.getState().pushToast('Could not delete the task. Check your connection and try again.', undefined, 'error');
      return;
    }
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    if (task) useUIStore.getState().pushToast(`Deleted "${task.name}"`);
  }
}));
