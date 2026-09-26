import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import type { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  accentColor: '#6C4CFF',
  glassIntensity: 60,
  blurIntensity: 40,
  radius: 20,
  density: 'comfortable',
  animationLevel: 'full',
  reducedTransparency: false,
  dateFormat: 'MMM d, yyyy',
  timeFormat: '12h',
  firstDayOfWeek: 0,
  scoringPrecision: 2,
  defaultExamType: 'daily',
  defaultTaskPriority: 'medium',
  notificationPrefs: { exams: true, tasks: true },
  dashboardLayout: [
    { id: 'todays-tasks', visible: true, order: 0, size: 'md' },
    { id: 'upcoming-exam', visible: true, order: 1, size: 'md' }
  ],
  streaksEnabled: true,
  onboardingCompleted: false,
  showFocusNow: true,
  showDailyMission: true,
  celebratedMilestoneIds: [],
  celebrationBaselineDone: false,
  notifiedReminderIds: []
};

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  subscribed: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  updateSettings: (changes: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

let channel: ReturnType<typeof supabase.channel> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(settings: AppSettings) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    supabase.from('app_settings').upsert({ user_id: userId, data: settings }).then();
  }, 350);
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  subscribed: false,

  hydrate: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const { data } = await supabase.from('app_settings').select('data').eq('user_id', userId).maybeSingle();
    if (data?.data) {
      set({ settings: { ...DEFAULT_SETTINGS, ...(data.data as Partial<AppSettings>) }, loaded: true });
    } else {
      await supabase.from('app_settings').insert({ user_id: userId, data: DEFAULT_SETTINGS });
      set({ settings: DEFAULT_SETTINGS, loaded: true });
    }
  },

  subscribe: () => {
    if (get().subscribed) return;
    channel = supabase
      .channel('settings-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
        const incoming = (payload.new as { data: Partial<AppSettings> }).data;
        set({ settings: { ...DEFAULT_SETTINGS, ...incoming } });
      })
      .subscribe();
    set({ subscribed: true });
  },

  unsubscribe: () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    set({ subscribed: false });
  },

  updateSettings: (changes) => {
    const next = { ...get().settings, ...changes };
    set({ settings: next });
    scheduleSave(next);
  },

  resetSettings: () => {
    set({ settings: DEFAULT_SETTINGS });
    scheduleSave(DEFAULT_SETTINGS);
  }
}));
