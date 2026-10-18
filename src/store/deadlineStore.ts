import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

export type DeadlinePriority = 'low' | 'medium' | 'high';
export type DeadlineStatus = 'open' | 'done';

export interface Deadline {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  dueDate: string;
  /** HH:MM */
  dueTime?: string;
  priority: DeadlinePriority;
  category?: string;
  notes?: string;
  status: DeadlineStatus;
  createdAt: number;
  updatedAt: number;
}

export type DeadlinePayload = Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>;

interface DeadlineRow {
  id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  priority: DeadlinePriority;
  category: string | null;
  notes: string | null;
  status: DeadlineStatus;
  created_at: string;
  updated_at: string;
}

function mapDeadline(row: DeadlineRow): Deadline {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : undefined,
    priority: row.priority,
    category: row.category ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  };
}

function toRow(data: Partial<DeadlinePayload>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.title !== undefined) row.title = data.title;
  if (data.dueDate !== undefined) row.due_date = data.dueDate;
  if (data.dueTime !== undefined) row.due_time = data.dueTime || null;
  if (data.priority !== undefined) row.priority = data.priority;
  if (data.category !== undefined) row.category = data.category || null;
  if (data.notes !== undefined) row.notes = data.notes || null;
  if (data.status !== undefined) row.status = data.status;
  return row;
}

interface DeadlineStore {
  deadlines: Deadline[];
  loading: boolean;
  loaded: boolean;
  subscribed: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  addDeadline: (data: DeadlinePayload) => Promise<Deadline | null>;
  updateDeadline: (id: string, changes: Partial<DeadlinePayload>) => Promise<boolean>;
  toggleDone: (id: string) => Promise<void>;
  /** Deletes the deadline from the account for good (no copy is kept). */
  deleteDeadline: (id: string) => Promise<boolean>;
}

let channel: ReturnType<typeof supabase.channel> | null = null;

export const useDeadlineStore = create<DeadlineStore>((set, get) => ({
  deadlines: [],
  loading: false,
  loaded: false,
  subscribed: false,

  hydrate: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('deadlines')
      .select('*')
      .order('due_date', { ascending: true })
      .order('due_time', { ascending: true, nullsFirst: false });
    // a failed read must not look like "no deadlines"
    if (error || !data) {
      set({ loading: false });
      return;
    }
    set({ deadlines: data.map((r) => mapDeadline(r as DeadlineRow)), loading: false, loaded: true });
  },

  subscribe: () => {
    if (get().subscribed) return;
    channel = supabase
      .channel('deadlines-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, () => get().hydrate())
      .subscribe();
    set({ subscribed: true });
  },

  unsubscribe: () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    set({ subscribed: false });
  },

  addDeadline: async (data) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return null;
    const { data: row, error } = await supabase
      .from('deadlines')
      .insert({ user_id: userId, ...toRow(data) })
      .select()
      .single();
    if (error || !row) {
      useUIStore.getState().pushToast('Could not save the deadline. Please try again.', undefined, 'error');
      return null;
    }
    const deadline = mapDeadline(row as DeadlineRow);
    set((s) => ({ deadlines: [...s.deadlines, deadline] }));
    return deadline;
  },

  updateDeadline: async (id, changes) => {
    const { data: row, error } = await supabase
      .from('deadlines')
      .update(toRow(changes))
      .eq('id', id)
      .select()
      .single();
    if (error || !row) {
      useUIStore.getState().pushToast('Could not save the deadline. Please try again.', undefined, 'error');
      return false;
    }
    const updated = mapDeadline(row as DeadlineRow);
    set((s) => ({ deadlines: s.deadlines.map((d) => (d.id === id ? updated : d)) }));
    return true;
  },

  toggleDone: async (id) => {
    const deadline = get().deadlines.find((d) => d.id === id);
    if (!deadline) return;
    await get().updateDeadline(id, { status: deadline.status === 'done' ? 'open' : 'done' });
  },

  deleteDeadline: async (id) => {
    const deadline = get().deadlines.find((d) => d.id === id);
    const { error } = await supabase.from('deadlines').delete().eq('id', id);
    if (error) {
      useUIStore.getState().pushToast('Could not delete the deadline. Please try again.', undefined, 'error');
      return false;
    }
    set((s) => ({ deadlines: s.deadlines.filter((d) => d.id !== id) }));
    if (deadline) useUIStore.getState().pushToast(`Deleted "${deadline.title}"`);
    return true;
  }
}));
