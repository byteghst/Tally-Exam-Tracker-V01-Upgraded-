import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_CITY } from '@/lib/prayer/cities';
import type { AsrMadhab, PrayerMethod } from '@/lib/prayer/times';

interface PrayerStore {
  cityName: string;
  method: PrayerMethod;
  madhab: AsrMadhab;
  setCity: (name: string) => void;
  setMethod: (method: PrayerMethod) => void;
  setMadhab: (madhab: AsrMadhab) => void;
}

/**
 * Where the prayer times are worked out for. Kept on this device only (the
 * times themselves are calculated, never stored anywhere), so it costs
 * nothing on the Supabase plan. Defaults suit Bangladesh: Karachi method,
 * Hanafi Asr.
 */
export const usePrayerStore = create<PrayerStore>()(
  persist(
    (set) => ({
      cityName: DEFAULT_CITY,
      method: 'karachi',
      madhab: 'hanafi',
      setCity: (cityName) => set({ cityName }),
      setMethod: (method) => set({ method }),
      setMadhab: (madhab) => set({ madhab })
    }),
    {
      name: 'tally-prayer-v1',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
