import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

/** One prayer's time limit: it begins at `start` and its time runs out at `end`. */
export interface PrayerWindow {
  key: PrayerKey;
  name: string;
  start: Date;
  end: Date;
}

export type ProhibitedKey = 'sunrise' | 'zenith' | 'sunset';

/** A stretch of the day when praying is not allowed. */
export interface ProhibitedWindow {
  key: ProhibitedKey;
  name: string;
  start: Date;
  end: Date;
  /** What to tell the person while it is happening. */
  detail: string;
}

export interface DayPrayers {
  /** Fajr, Dhuhr, Asr, Maghrib, Isha for the day. Isha runs until the next day's Fajr. */
  windows: PrayerWindow[];
  /** When the previous night's Isha began (it is still running between midnight and Fajr). */
  prevIshaStart: Date;
  /** The three times of day when no prayer may be offered. */
  prohibited: ProhibitedWindow[];
}

/**
 * The rules of the Islamic Foundation Bangladesh timetable, which this widget
 * follows:
 *  - prayer times are worked out with the University of Islamic Sciences,
 *    Karachi method (Fajr and Isha at 18 degrees) and the Hanafi Asr;
 *  - 3 minutes are added to Fajr, Dhuhr and Maghrib as a precaution;
 *  - no prayer for 24 minutes after sunrise, for the 6 minutes before the
 *    (printed) Dhuhr time, and for the 24 minutes before sunset. If today's
 *    Asr has not been prayed yet it is still prayed in that last stretch.
 */
export const IF_RULES = {
  precautionMinutes: 3,
  afterSunriseMinutes: 24,
  beforeDhuhrMinutes: 6,
  beforeSunsetMinutes: 24
} as const;

function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function shiftMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function params() {
  const p = CalculationMethod.Karachi();
  p.madhab = Madhab.Hanafi;
  return p;
}

/**
 * The five prayer windows for one day, plus the three prohibited times,
 * following the Islamic Foundation rules above. Everything is calculated on
 * the device from the place's coordinates, so it needs no internet and no
 * account.
 *
 * Each prayer's time ends where the next begins, except that Fajr ends at
 * sunrise, Asr at sunset (Maghrib then starts 3 minutes later), and Isha at
 * the next day's printed Fajr time.
 */
export function computeDay(date: Date, lat: number, lng: number): DayPrayers {
  const coords = new Coordinates(lat, lng);
  const p = params();
  const today = new PrayerTimes(coords, date, p);
  const tomorrow = new PrayerTimes(coords, shiftDays(date, 1), p);
  const yesterday = new PrayerTimes(coords, shiftDays(date, -1), p);
  const extra = IF_RULES.precautionMinutes;

  const fajr = shiftMinutes(today.fajr, extra);
  const dhuhr = shiftMinutes(today.dhuhr, extra);
  // with the Karachi method Maghrib starts at sunset exactly
  const sunset = today.maghrib;
  const maghrib = shiftMinutes(sunset, extra);
  const nextFajr = shiftMinutes(tomorrow.fajr, extra);

  return {
    windows: [
      { key: 'fajr', name: 'Fajr', start: fajr, end: today.sunrise },
      { key: 'dhuhr', name: 'Dhuhr', start: dhuhr, end: today.asr },
      { key: 'asr', name: 'Asr', start: today.asr, end: sunset },
      { key: 'maghrib', name: 'Maghrib', start: maghrib, end: today.isha },
      { key: 'isha', name: 'Isha', start: today.isha, end: nextFajr }
    ],
    prevIshaStart: yesterday.isha,
    prohibited: [
      {
        key: 'sunrise',
        name: 'Sunrise',
        start: today.sunrise,
        end: shiftMinutes(today.sunrise, IF_RULES.afterSunriseMinutes),
        detail: 'The sun is rising. No prayer at all, not even a make-up prayer, until it has fully risen.'
      },
      {
        key: 'zenith',
        name: 'Sun at its highest',
        start: shiftMinutes(dhuhr, -IF_RULES.beforeDhuhrMinutes),
        end: dhuhr,
        detail: 'The sun is at its highest point. No prayer at all until Dhuhr begins.'
      },
      {
        key: 'sunset',
        name: 'Sunset',
        start: shiftMinutes(sunset, -IF_RULES.beforeSunsetMinutes),
        end: sunset,
        detail: 'The sun is setting. No prayer until it has set. If you have not prayed today\u2019s Asr yet, pray it now.'
      }
    ]
  };
}

/** "4:50 AM" */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "1h 24m", "25m", or "<1m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return '<1m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
