import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useUIStore } from '@/store/uiStore';
import { parseISODate, toISODate } from '@/lib/dates';
import type { PrayerKey } from '@/lib/prayer/times';

export const PRAYER_KEYS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** How many days back the tracker reads. Plenty for the week strip and the streak. */
const HISTORY_DAYS = 60;

function shiftISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** The day before a yyyy-mm-dd date. */
export function previousDayISO(iso: string): string {
  return shiftISO(iso, -1);
}

/** The last `count` dates ending on `endISO`, oldest first. */
export function lastDays(endISO: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftISO(endISO, -i));
  return out;
}

/**
 * Days in a row on which all five prayers were marked. Today counts if it is
 * already complete; if it is not complete yet the streak is still alive and
 * counts back from yesterday.
 */
export function fullDayStreak(days: Record<string, PrayerKey[]>, todayISO: string): number {
  const complete = (iso: string): boolean => (days[iso]?.length ?? 0) >= PRAYER_KEYS.length;
  let cursor = complete(todayISO) ? todayISO : previousDayISO(todayISO);
  let streak = 0;
  while (complete(cursor) && streak <= HISTORY_DAYS) {
    streak++;
    cursor = previousDayISO(cursor);
  }
  return streak;
}

interface PrayerLogStore {
  /** yyyy-mm-dd to the prayers marked as prayed that day */
  days: Record<string, PrayerKey[]>;
  loaded: boolean;
  hydrate: () => Promise<void>;
  /** Marks a prayer as prayed, or takes the mark back (which deletes it from the account). */
  toggle: (date: string, key: PrayerKey) => Promise<void>;
}

export const usePrayerLogStore = create<PrayerLogStore>((set, get) => ({
  days: {},
  loaded: false,

  hydrate: async () => {
    const since = shiftISO(toISODate(new Date()), -HISTORY_DAYS);
    const { data, error } = await supabase.from('prayer_log').select('prayed_on,prayer').gte('prayed_on', since);
    // a failed read must not look like "nothing prayed"
    if (error || !data) return;
    const days: Record<string, PrayerKey[]> = {};
    for (const row of data as Array<{ prayed_on: string; prayer: PrayerKey }>) {
      (days[row.prayed_on] ??= []).push(row.prayer);
    }
    set({ days, loaded: true });
  },

  toggle: async (date, key) => {
    const had = (get().days[date] ?? []).includes(key);
    const apply = (add: boolean): void =>
      set((s) => {
        const current = s.days[date] ?? [];
        const next = add ? (current.includes(key) ? current : [...current, key]) : current.filter((k) => k !== key);
        return { days: { ...s.days, [date]: next } };
      });

    apply(!had); // show it straight away, undo if saving fails
    const { error } = had
      ? await supabase.from('prayer_log').delete().eq('prayed_on', date).eq('prayer', key)
      : await supabase.from('prayer_log').insert({ prayed_on: date, prayer: key });
    // 23505 = it was already saved, which is the state we wanted
    if (error && error.code !== '23505') {
      apply(had);
      useUIStore.getState().pushToast("Couldn't save that. Please try again.", undefined, 'error');
    }
  }
}));
