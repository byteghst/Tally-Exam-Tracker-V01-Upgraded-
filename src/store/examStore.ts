import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { enqueue, flushOutbox, isNetworkFailure, isOffline, makeId, pendingCount } from '@/lib/outbox';
import type { Exam, ExamStatus } from '@/types';

interface ExamRow {
  id: string;
  config_id: string | null;
  name: string;
  type: Exam['type'];
  date: string;
  start_time: string | null;
  status: ExamStatus;
  mcq_count: number;
  mcq_marks_each: number;
  written_count: number;
  written_marks_each: number;
  negative_mark_per_wrong: number;
  mcq_correct: number | null;
  mcq_wrong: number | null;
  mcq_unanswered: number | null;
  written_marks_obtained: number | null;
  manual_score_override: number | null;
  rank: number | null;
  participants: number | null;
  notes: string | null;
  reminder_minutes_before: number | null;
  created_at: string;
  updated_at: string;
}

function mapExam(row: ExamRow): Exam {
  return {
    id: row.id,
    configId: row.config_id ?? undefined,
    name: row.name,
    type: row.type,
    date: row.date,
    startTime: row.start_time ?? undefined,
    status: row.status,
    mcqCount: row.mcq_count,
    mcqMarksEach: Number(row.mcq_marks_each),
    writtenCount: row.written_count,
    writtenMarksEach: Number(row.written_marks_each),
    negativeMarkPerWrong: Number(row.negative_mark_per_wrong),
    mcqCorrect: row.mcq_correct ?? undefined,
    mcqWrong: row.mcq_wrong ?? undefined,
    mcqUnanswered: row.mcq_unanswered ?? undefined,
    writtenMarksObtained: row.written_marks_obtained !== null ? Number(row.written_marks_obtained) : undefined,
    manualScoreOverride: row.manual_score_override !== null ? Number(row.manual_score_override) : undefined,
    rank: row.rank ?? undefined,
    participants: row.participants ?? undefined,
    notes: row.notes ?? undefined,
    reminderMinutesBefore: row.reminder_minutes_before ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  };
}

/*
 * Payloads use `null` for "clear this optional field" and plain `undefined`
 * (i.e. the key simply isn't present) for "not part of this update" —
 * `updateExam` only writes keys that are present. Before this distinction
 * existed, clearing a field (e.g. removing a manual score override) sent
 * `undefined`, which `toRow` treated as "don't touch", so the old value
 * silently stayed in the database. A real `0` was never affected by this —
 * `0 !== undefined` — but an intentional clear was.
 */
type NullableExamPayload = {
  [K in keyof Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>]: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>[K] | null;
};

type ExamPayload = Partial<NullableExamPayload>;

function toRow(data: ExamPayload) {
  const row: Record<string, unknown> = {};
  if (data.configId !== undefined) row.config_id = data.configId;
  if (data.name !== undefined) row.name = data.name;
  if (data.type !== undefined) row.type = data.type;
  if (data.date !== undefined) row.date = data.date;
  if (data.startTime !== undefined) row.start_time = data.startTime;
  if (data.status !== undefined) row.status = data.status;
  if (data.mcqCount !== undefined) row.mcq_count = data.mcqCount;
  if (data.mcqMarksEach !== undefined) row.mcq_marks_each = data.mcqMarksEach;
  if (data.writtenCount !== undefined) row.written_count = data.writtenCount;
  if (data.writtenMarksEach !== undefined) row.written_marks_each = data.writtenMarksEach;
  if (data.negativeMarkPerWrong !== undefined) row.negative_mark_per_wrong = data.negativeMarkPerWrong;
  if (data.mcqCorrect !== undefined) row.mcq_correct = data.mcqCorrect;
  if (data.mcqWrong !== undefined) row.mcq_wrong = data.mcqWrong;
  if (data.mcqUnanswered !== undefined) row.mcq_unanswered = data.mcqUnanswered;
  if (data.writtenMarksObtained !== undefined) row.written_marks_obtained = data.writtenMarksObtained;
  if (data.manualScoreOverride !== undefined) row.manual_score_override = data.manualScoreOverride;
  if (data.rank !== undefined) row.rank = data.rank;
  if (data.participants !== undefined) row.participants = data.participants;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.reminderMinutesBefore !== undefined) row.reminder_minutes_before = data.reminderMinutesBefore;
  return row;
}

/** A blank row, so an exam built on the device has every column the mapper reads. */
const EMPTY_ROW = {
  id: '',
  config_id: null,
  name: '',
  type: 'daily',
  date: '',
  start_time: null,
  status: 'upcoming',
  mcq_count: 0,
  mcq_marks_each: 0,
  written_count: 0,
  written_marks_each: 0,
  negative_mark_per_wrong: 0,
  mcq_correct: null,
  mcq_wrong: null,
  mcq_unanswered: null,
  written_marks_obtained: null,
  manual_score_override: null,
  rank: null,
  participants: null,
  notes: null,
  reminder_minutes_before: null,
  created_at: '',
  updated_at: ''
} as unknown as ExamRow;

/** The exam as it should look after `payload` is applied on top of `base` (offline, no server round-trip). */
function localExam(id: string, base: Exam | null, payload: ExamPayload): Exam {
  const now = new Date().toISOString();
  const row = {
    ...EMPTY_ROW,
    ...(base ? toRow(base) : {}),
    ...toRow(payload),
    id,
    created_at: base ? new Date(base.createdAt).toISOString() : now,
    updated_at: now
  } as unknown as ExamRow;
  return mapExam(row);
}

interface ExamStore {
  exams: Exam[];
  loading: boolean;
  /** true once exams have been read successfully at least once (an empty list is then genuinely empty). */
  loaded: boolean;
  subscribed: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  addExam: (data: ExamPayload) => Promise<Exam | null>;
  updateExam: (id: string, changes: ExamPayload) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  duplicateExam: (id: string) => Promise<void>;
}

let channel: ReturnType<typeof supabase.channel> | null = null;

export const useExamStore = create<ExamStore>((set, get) => ({
  exams: [],
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
    const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: true });
    // A failed read (offline, expired session...) must not look like "no exams":
    // keep what we already have and leave `loaded` as it was, so nothing
    // downstream (such as reminder scheduling) acts on missing data.
    if (error || !data) {
      set({ loading: false });
      return;
    }
    set({ exams: data.map((r) => mapExam(r as ExamRow)), loading: false, loaded: true });
  },

  subscribe: () => {
    if (get().subscribed) return;
    channel = supabase
      .channel('exams-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exams' }, (payload) => {
        const exam = mapExam(payload.new as ExamRow);
        set((s) => (s.exams.some((e) => e.id === exam.id) ? s : { exams: [...s.exams, exam] }));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'exams' }, (payload) => {
        const exam = mapExam(payload.new as ExamRow);
        set((s) => ({ exams: s.exams.map((e) => (e.id === exam.id ? exam : e)) }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'exams' }, (payload) => {
        const oldId = (payload.old as { id: string }).id;
        set((s) => ({ exams: s.exams.filter((e) => e.id !== oldId) }));
      })
      .subscribe();
    set({ subscribed: true });
  },

  unsubscribe: () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    set({ subscribed: false });
  },

  addExam: async (data) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return null;
    const id = makeId();

    // No connection: show the exam now and queue it to be sent later.
    const saveOffline = (): Exam => {
      const exam = localExam(id, null, data);
      enqueue(userId, { table: 'exams', kind: 'insert', rowId: id, row: { id, user_id: userId, ...toRow(data) } });
      set((s) => ({ exams: [...s.exams, exam] }));
      void flushOutbox(userId);
      return exam;
    };
    if (isOffline()) return saveOffline();

    const { data: row, error, status } = await supabase
      .from('exams')
      .insert({ id, user_id: userId, ...toRow(data) })
      .select()
      .single();
    if (error || !row) {
      if (error && isNetworkFailure(error, status)) return saveOffline();
      useUIStore.getState().pushToast('Could not save the exam. Please try again.', undefined, 'error');
      return null;
    }
    const exam = mapExam(row as ExamRow);
    set((s) => (s.exams.some((e) => e.id === exam.id) ? s : { exams: [...s.exams, exam] }));
    return exam;
  },

  updateExam: async (id, changes) => {
    const saveOffline = (): boolean => {
      const userId = useAuthStore.getState().user?.id;
      const existing = get().exams.find((e) => e.id === id);
      if (!userId || !existing) return false;
      const exam = localExam(id, existing, changes);
      set((s) => ({ exams: s.exams.map((e) => (e.id === id ? exam : e)) }));
      const patch = toRow(changes);
      if (Object.keys(patch).length > 0) {
        enqueue(userId, { table: 'exams', kind: 'update', rowId: id, row: patch });
        void flushOutbox(userId);
      }
      return true;
    };
    if (isOffline() && saveOffline()) return;

    const { data: row, error, status } = await supabase.from('exams').update(toRow(changes)).eq('id', id).select().single();
    if (error || !row) {
      if (error && isNetworkFailure(error, status) && saveOffline()) return;
      useUIStore.getState().pushToast('Could not save the change. Check your connection and try again.', undefined, 'error');
      return;
    }
    const exam = mapExam(row as ExamRow);
    set((s) => ({ exams: s.exams.map((e) => (e.id === id ? exam : e)) }));
  },

  deleteExam: async (id) => {
    const exam = get().exams.find((e) => e.id === id);
    const removeOffline = (): boolean => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return false;
      set((s) => ({ exams: s.exams.filter((e) => e.id !== id) }));
      enqueue(userId, { table: 'exams', kind: 'delete', rowId: id });
      void flushOutbox(userId);
      if (exam) useUIStore.getState().pushToast(`Deleted "${exam.name}"`);
      return true;
    };
    if (isOffline() && removeOffline()) return;

    const { error, status } = await supabase.from('exams').delete().eq('id', id);
    // Only drop it from the screen if the delete is saved (or queued); otherwise it
    // would look done and the exam would reappear later.
    if (error) {
      if (isNetworkFailure(error, status) && removeOffline()) return;
      useUIStore.getState().pushToast('Could not delete the exam. Check your connection and try again.', undefined, 'error');
      return;
    }
    set((s) => ({ exams: s.exams.filter((e) => e.id !== id) }));
    if (exam) useUIStore.getState().pushToast(`Deleted "${exam.name}"`);
  },

  duplicateExam: async (id) => {
    const exam = get().exams.find((e) => e.id === id);
    if (!exam) return;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = exam;
    await get().addExam({
      ...rest,
      status: 'upcoming',
      mcqCorrect: null,
      mcqWrong: null,
      mcqUnanswered: null,
      writtenMarksObtained: null,
      manualScoreOverride: null,
      rank: null,
      participants: null
    });
  }
}));
