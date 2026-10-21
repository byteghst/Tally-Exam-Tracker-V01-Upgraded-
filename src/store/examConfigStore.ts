import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import type { ExamConfig, ExamConfigTypeSetting, ExamType } from '@/types';

interface ConfigRow {
  id: string;
  name: string;
  negative_mark_per_wrong: number;
  created_at: string;
  updated_at: string;
}

interface ConfigTypeRow {
  id: string;
  config_id: string;
  type: ExamType;
  mcq_count: number;
  mcq_marks_each: number;
  written_count: number;
  written_marks_each: number;
}

function mapConfig(row: ConfigRow, typeRows: ConfigTypeRow[]): ExamConfig {
  return {
    id: row.id,
    name: row.name,
    negativeMarkPerWrong: Number(row.negative_mark_per_wrong),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    types: typeRows
      .filter((t) => t.config_id === row.id)
      .map((t) => ({
        type: t.type,
        mcqCount: t.mcq_count,
        mcqMarksEach: Number(t.mcq_marks_each),
        writtenCount: t.written_count,
        writtenMarksEach: Number(t.written_marks_each)
      }))
  };
}

interface ExamConfigStore {
  configs: ExamConfig[];
  loading: boolean;
  /** true once configs have been read successfully at least once (an empty list is then genuinely empty). */
  loaded: boolean;
  subscribed: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  addConfig: (data: { name: string; negativeMarkPerWrong: number; types: ExamConfigTypeSetting[] }) => Promise<ExamConfig | null>;
  updateConfig: (
    id: string,
    data: { name: string; negativeMarkPerWrong: number; types: ExamConfigTypeSetting[] }
  ) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
}

let channel: ReturnType<typeof supabase.channel> | null = null;

export const useExamConfigStore = create<ExamConfigStore>((set, get) => ({
  configs: [],
  loading: false,
  loaded: false,
  subscribed: false,

  hydrate: async () => {
    set({ loading: true });
    const [configsRes, typesRes] = await Promise.all([
      supabase.from('exam_configs').select('*').order('created_at', { ascending: true }),
      supabase.from('exam_config_types').select('*')
    ]);
    // A failed read (offline, expired session...) must not look like "no configs":
    // keep what we already have instead of replacing it with an empty list.
    if (configsRes.error || typesRes.error || !configsRes.data || !typesRes.data) {
      set({ loading: false });
      return;
    }
    const typeRows = typesRes.data as ConfigTypeRow[];
    const mapped = configsRes.data.map((c) => mapConfig(c as ConfigRow, typeRows));
    set({ configs: mapped, loading: false, loaded: true });
  },

  subscribe: () => {
    if (get().subscribed) return;
    channel = supabase
      .channel('exam-configs-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_configs' }, () => get().hydrate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_config_types' }, () => get().hydrate())
      .subscribe();
    set({ subscribed: true });
  },

  unsubscribe: () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    set({ subscribed: false });
  },

  addConfig: async ({ name, negativeMarkPerWrong, types }) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return null;

    const { data: configRow, error } = await supabase
      .from('exam_configs')
      .insert({ user_id: userId, name, negative_mark_per_wrong: negativeMarkPerWrong })
      .select()
      .single();
    if (error || !configRow) return null;

    if (types.length > 0) {
      await supabase.from('exam_config_types').insert(
        types.map((t) => ({
          config_id: configRow.id,
          type: t.type,
          mcq_count: t.mcqCount,
          mcq_marks_each: t.mcqMarksEach,
          written_count: t.writtenCount,
          written_marks_each: t.writtenMarksEach
        }))
      );
    }
    await get().hydrate();
    return get().configs.find((c) => c.id === configRow.id) ?? null;
  },

  updateConfig: async (id, { name, negativeMarkPerWrong, types }) => {
    await supabase
      .from('exam_configs')
      .update({ name, negative_mark_per_wrong: negativeMarkPerWrong })
      .eq('id', id);

    // Simplest consistent approach: replace the whole type set on every edit.
    await supabase.from('exam_config_types').delete().eq('config_id', id);
    if (types.length > 0) {
      await supabase.from('exam_config_types').insert(
        types.map((t) => ({
          config_id: id,
          type: t.type,
          mcq_count: t.mcqCount,
          mcq_marks_each: t.mcqMarksEach,
          written_count: t.writtenCount,
          written_marks_each: t.writtenMarksEach
        }))
      );
    }
    await get().hydrate();
  },

  deleteConfig: async (id) => {
    await supabase.from('exam_configs').delete().eq('id', id);
    set({ configs: get().configs.filter((c) => c.id !== id) });
  }
}));
