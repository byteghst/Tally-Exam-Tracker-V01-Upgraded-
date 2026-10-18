import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_CITY } from '@/lib/prayer/cities';

interface PrayerStore {
  cityName: string;
  setCity: (name: string) => void;
}

/**
 * Which district the prayer times are worked out for. Kept on this device
 * only (the times themselves are calculated, never stored anywhere), so it
 * costs nothing on the Supabase plan. Everything else follows the Islamic
 * Foundation Bangladesh rules (see lib/prayer/times).
 */
export const usePrayerStore = create<PrayerStore>()(
  persist(
    (set) => ({
      cityName: DEFAULT_CITY,
      setCity: (cityName) => set({ cityName })
    }),
    {
      name: 'tally-prayer-v1',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
