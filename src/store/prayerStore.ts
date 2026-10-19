import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_CITY } from '@/lib/prayer/cities';

interface PrayerStore {
  cityName: string;
  /** Notify when a prayer's time begins. */
  remindStart: boolean;
  /** Notify ten minutes before a prayer's time runs out. */
  remindEnding: boolean;
  /** Send a special alert when a prohibited time begins. */
  remindProhibited: boolean;
  setCity: (name: string) => void;
  setRemindStart: (on: boolean) => void;
  setRemindEnding: (on: boolean) => void;
  setRemindProhibited: (on: boolean) => void;
}

/**
 * Which district the prayer times are worked out for, and which prayer
 * reminders are on. Kept on this device only (the times themselves are
 * calculated, never stored anywhere), so it costs nothing on the Supabase
 * plan. Everything else follows the Islamic Foundation Bangladesh rules (see
 * lib/prayer/times). Reminders default to on.
 */
export const usePrayerStore = create<PrayerStore>()(
  persist(
    (set) => ({
      cityName: DEFAULT_CITY,
      remindStart: true,
      remindEnding: true,
      remindProhibited: true,
      setCity: (cityName) => set({ cityName }),
      setRemindStart: (remindStart) => set({ remindStart }),
      setRemindEnding: (remindEnding) => set({ remindEnding }),
      setRemindProhibited: (remindProhibited) => set({ remindProhibited })
    }),
    {
      name: 'tally-prayer-v1',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
