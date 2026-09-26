import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import type { Exam, ExamStatus } from '@/types';

interface ExamRow {
  id: string;
  config_id: string | null;
  name: string;
  type: Exam['type'];
  date: string;
  start_time: string | null;
  end_time: string | null;
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
    endTime: row.end_time ?? undefined,
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
  if (data.endTime !== undefined) row.end_time = data.endTime;
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

interface ExamStore {
  exams: Exam[];
  loading: boolean;
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
  subscribed: false,

  hydrate: async () => {
    set({ loading: true });
    const { data } = await supabase.from('exams').select('*').order('date', { ascending: true });
    set({ exams: (data ?? []).map((r) => mapExam(r as ExamRow)), loading: false });
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
    const { data: row, error } = await supabase
      .from('exams')
      .insert({ user_id: userId, ...toRow(data) })
      .select()
      .single();
    if (error || !row) {
      useUIStore.getState().pushToast('Could not save the exam. Please try again.', undefined, 'error');
      return null;
    }
    const exam = mapExam(row as ExamRow);
    set((s) => (s.exams.some((e) => e.id === exam.id) ? s : { exams: [...s.exams, exam] }));
    return exam;
  },

  updateExam: async (id, changes) => {
    const { data: row, error } = await supabase.from('exams').update(toRow(changes)).eq('id', id).select().single();
    if (error || !row) return;
    const exam = mapExam(row as ExamRow);
    set((s) => ({ exams: s.exams.map((e) => (e.id === id ? exam : e)) }));
  },

  deleteExam: async (id) => {
    const exam = get().exams.find((e) => e.id === id);
    await supabase.from('exams').delete().eq('id', id);
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
