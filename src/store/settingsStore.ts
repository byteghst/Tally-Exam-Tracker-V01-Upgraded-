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

// ---------------------------------------------------------------------------
// Device copy of the settings.
//
// The account (database) copy is the source of truth, but a copy is also kept
// on this phone so the person's name and "intro already seen" are correct the
// instant the app opens — even on a slow or missing connection — instead of
// flashing defaults while the network call is in flight. `dirty` means "has
// changes the database hasn't confirmed yet"; those are pushed on next launch.
// ---------------------------------------------------------------------------
const CACHE_PREFIX = 'tally-settings-v1:';

interface CacheRecord {
  settings: AppSettings;
  dirty: boolean;
}

function readCache(userId: string): CacheRecord | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheRecord> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.settings) return null;
    return { settings: { ...DEFAULT_SETTINGS, ...parsed.settings }, dirty: parsed.dirty === true };
  } catch {
    return null;
  }
}

function writeCache(userId: string, settings: AppSettings, dirty: boolean): void {
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify({ settings, dirty }));
  } catch {
    // storage full or unavailable — the database copy still works
  }
}

interface SettingsStore {
  settings: AppSettings;
  /**
   * true once we know what is actually saved for this account. Until then the
   * values in `settings` are placeholders, so nothing may be written to the
   * database and nothing (like the intro popup) may be decided from them.
   */
  loaded: boolean;
  subscribed: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  updateSettings: (changes: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

let channel: ReturnType<typeof supabase.channel> | null = null;
let activeUserId: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveSeq = 0; // bumps on every local change
let savesInFlight = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

export const useSettingsStore = create<SettingsStore>((set, get) => {
  function saveToCloud(userId: string, attempt = 0) {
    if (saveTimer) clearTimeout(saveTimer);
    const seq = saveSeq;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      if (activeUserId !== userId) return;
      savesInFlight += 1;
      const { error } = await supabase.from('app_settings').upsert({ user_id: userId, data: get().settings });
      savesInFlight -= 1;
      if (activeUserId !== userId) return;
      if (!error) {
        // Only mark the device copy as confirmed if nothing newer was changed meanwhile.
        if (seq === saveSeq) writeCache(userId, get().settings, false);
      } else if (attempt < 5) {
        // Offline or server hiccup: try again shortly. The device copy stays "dirty"
        // either way, so it is also pushed next time the app opens.
        setTimeout(() => {
          if (activeUserId === userId && saveTimer === null) saveToCloud(userId, attempt + 1);
        }, 10_000 * (attempt + 1));
      }
    }, 350);
  }

  function scheduleRetry() {
    if (retryTimer || retryCount >= 8) return;
    const delay = Math.min(3000 * 2 ** retryCount, 60_000);
    retryCount += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void get().hydrate();
    }, delay);
  }

  return {
    settings: DEFAULT_SETTINGS,
    loaded: false,
    subscribed: false,

    hydrate: async () => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      // A different account (or the first run): start clean so one person's
      // settings are never shown to, or saved over, another's.
      if (activeUserId !== userId) {
        activeUserId = userId;
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        retryCount = 0;
        set({ settings: DEFAULT_SETTINGS, loaded: false });
      }

      // 1) Instant: what this phone already has (name, intro seen, layout...).
      const cached = readCache(userId);
      if (cached) set({ settings: cached.settings, loaded: true });

      // 2) The account copy.
      const { data, error } = await supabase.from('app_settings').select('data').eq('user_id', userId).maybeSingle();
      if (activeUserId !== userId) return; // signed out / switched while waiting

      if (error) {
        // A failed read means "unknown", NOT "nothing saved". Treating it as empty
        // would let default values overwrite the real settings. Keep whatever the
        // device copy has and try again shortly.
        scheduleRetry();
        return;
      }
      retryCount = 0;

      if (data?.data) {
        const cloud: AppSettings = { ...DEFAULT_SETTINGS, ...(data.data as Partial<AppSettings>) };
        if (cached?.dirty) {
          // This phone has changes the account never received (e.g. made offline).
          // Keep them and send them up.
          set({ settings: cached.settings, loaded: true });
          saveSeq += 1;
          saveToCloud(userId);
        } else {
          set({ settings: cloud, loaded: true });
          writeCache(userId, cloud, false);
        }
      } else {
        // The read succeeded and there is genuinely no row: first run for this account.
        const initial = cached?.settings ?? DEFAULT_SETTINGS;
        set({ settings: initial, loaded: true });
        writeCache(userId, initial, false);
        await supabase.from('app_settings').upsert({ user_id: userId, data: initial });
      }
    },

    subscribe: () => {
      if (get().subscribed) return;
      channel = supabase
        .channel('settings-sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
          const userId = activeUserId;
          const incoming = payload.new as { user_id?: string; data: Partial<AppSettings> };
          if (!userId || (incoming.user_id && incoming.user_id !== userId)) return;
          // Ignore the echo of our own save while newer local changes are still on their way.
          if (saveTimer !== null || savesInFlight > 0) return;
          const next: AppSettings = { ...DEFAULT_SETTINGS, ...incoming.data };
          set({ settings: next, loaded: true });
          writeCache(userId, next, false);
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
      const userId = activeUserId;
      // Never save before we know what is already saved — otherwise placeholder
      // defaults would overwrite the real settings (the name, the intro flag...).
      if (!userId || !get().loaded) return;
      const next = { ...get().settings, ...changes };
      saveSeq += 1;
      set({ settings: next });
      writeCache(userId, next, true);
      saveToCloud(userId);
    },

    resetSettings: () => {
      const userId = activeUserId;
      if (!userId || !get().loaded) return;
      const current = get().settings;
      // Resetting restores the look and preferences, but keeps who the person is
      // and what they have already seen: their name, the intro, and bookkeeping.
      const next: AppSettings = {
        ...DEFAULT_SETTINGS,
        userName: current.userName,
        onboardingCompleted: current.onboardingCompleted,
        celebrationBaselineDone: current.celebrationBaselineDone,
        celebratedMilestoneIds: current.celebratedMilestoneIds,
        notifiedReminderIds: current.notifiedReminderIds,
        dailyMissionDismissedDate: current.dailyMissionDismissedDate
      };
      saveSeq += 1;
      set({ settings: next });
      writeCache(userId, next, true);
      saveToCloud(userId);
    }
  };
});
