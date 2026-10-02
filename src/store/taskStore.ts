import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { expandRecurrence } from '@/lib/dates';
import type { Task } from '@/types';

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
  if (data.recurrence !== undefined) row.recurrence = data.recurrence ?? null;
  if (data.seriesId !== undefined) row.series_id = data.seriesId ?? null;
  if (data.reminderMinutesBefore !== undefined) row.reminder_minutes_before = data.reminderMinutesBefore ?? null;
  return row;
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
  toggleComplete: (id: string) => Promise<void>;
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
    const { data: row, error } = await supabase
      .from('tasks')
      .insert({ user_id: userId, ...toRow(data) })
      .select()
      .single();
    if (error || !row) {
      useUIStore.getState().pushToast('Could not save the task. Please try again.', undefined, 'error');
      return null;
    }
    const task = mapTask(row as TaskRow);
    if (task.recurrence && task.date) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 60);
      await ensureRecurringInstances(task, task.date, horizon.toISOString().slice(0, 10));
      await get().hydrate();
      return task;
    }
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  toggleComplete: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    await get().updateTask(id, { status: task.status === 'completed' ? 'todo' : 'completed' });
  },

  updateTask: async (id, changes) => {
    const { data: row, error } = await supabase.from('tasks').update(toRow(changes)).eq('id', id).select().single();
    if (error || !row) return;
    const updated = mapTask(row as TaskRow);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));

    if (updated.recurrence && updated.date) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 60);
      await ensureRecurringInstances(updated, updated.date, horizon.toISOString().slice(0, 10));
      await get().hydrate();
    }
  },

  deleteTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    await supabase.from('tasks').delete().eq('id', id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    if (task) useUIStore.getState().pushToast(`Deleted "${task.name}"`);
  }
}));
