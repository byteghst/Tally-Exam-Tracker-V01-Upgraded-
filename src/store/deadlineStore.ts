import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { enqueue, flushOutbox, isNetworkFailure, isOffline, makeId, pendingCount } from '@/lib/outbox';

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

/** A blank row, so a deadline built on the device has every column the mapper reads. */
const EMPTY_ROW: DeadlineRow = {
  id: '',
  title: '',
  due_date: '',
  due_time: null,
  priority: 'medium',
  category: null,
  notes: null,
  status: 'open',
  created_at: '',
  updated_at: ''
};

/** The deadline as it should look after `payload` is applied on top of `base` (offline, no server round-trip). */
function localDeadline(id: string, base: Deadline | null, payload: Partial<DeadlinePayload>): Deadline {
  const now = new Date().toISOString();
  const row = {
    ...EMPTY_ROW,
    ...(base ? toRow(base) : {}),
    ...toRow(payload),
    id,
    created_at: base ? new Date(base.createdAt).toISOString() : now,
    updated_at: now
  } as unknown as DeadlineRow;
  return mapDeadline(row);
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
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      // Send changes made offline first, so the read below can't overwrite them.
      await flushOutbox(userId);
      if (pendingCount(userId) > 0) return;
    }
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
    const id = makeId();

    // No connection: show the deadline now and queue it to be sent later.
    const saveOffline = (): Deadline => {
      const deadline = localDeadline(id, null, data);
      enqueue(userId, { table: 'deadlines', kind: 'insert', rowId: id, row: { id, user_id: userId, ...toRow(data) } });
      set((s) => ({ deadlines: [...s.deadlines, deadline] }));
      void flushOutbox(userId);
      return deadline;
    };
    if (isOffline()) return saveOffline();

    const { data: row, error, status } = await supabase
      .from('deadlines')
      .insert({ id, user_id: userId, ...toRow(data) })
      .select()
      .single();
    if (error || !row) {
      if (error && isNetworkFailure(error, status)) return saveOffline();
      useUIStore.getState().pushToast('Could not save the deadline. Please try again.', undefined, 'error');
      return null;
    }
    const deadline = mapDeadline(row as DeadlineRow);
    set((s) => ({ deadlines: [...s.deadlines, deadline] }));
    return deadline;
  },

  updateDeadline: async (id, changes) => {
    const saveOffline = (): boolean => {
      const userId = useAuthStore.getState().user?.id;
      const existing = get().deadlines.find((d) => d.id === id);
      if (!userId || !existing) return false;
      const updatedDeadline = localDeadline(id, existing, changes);
      set((s) => ({ deadlines: s.deadlines.map((d) => (d.id === id ? updatedDeadline : d)) }));
      const patch = toRow(changes);
      if (Object.keys(patch).length > 0) {
        enqueue(userId, { table: 'deadlines', kind: 'update', rowId: id, row: patch });
        void flushOutbox(userId);
      }
      return true;
    };
    if (isOffline() && saveOffline()) return true;

    const { data: row, error, status } = await supabase
      .from('deadlines')
      .update(toRow(changes))
      .eq('id', id)
      .select()
      .single();
    if (error || !row) {
      if (error && isNetworkFailure(error, status) && saveOffline()) return true;
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
    const removeOffline = (): boolean => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return false;
      set((s) => ({ deadlines: s.deadlines.filter((d) => d.id !== id) }));
      enqueue(userId, { table: 'deadlines', kind: 'delete', rowId: id });
      void flushOutbox(userId);
      if (deadline) useUIStore.getState().pushToast(`Deleted "${deadline.title}"`);
      return true;
    };
    if (isOffline() && removeOffline()) return true;

    const { error, status } = await supabase.from('deadlines').delete().eq('id', id);
    if (error) {
      if (isNetworkFailure(error, status) && removeOffline()) return true;
      useUIStore.getState().pushToast('Could not delete the deadline. Please try again.', undefined, 'error');
      return false;
    }
    set((s) => ({ deadlines: s.deadlines.filter((d) => d.id !== id) }));
    if (deadline) useUIStore.getState().pushToast(`Deleted "${deadline.title}"`);
    return true;
  }
}));
