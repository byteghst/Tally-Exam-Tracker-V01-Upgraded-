import { CalculationMethod, Coordinates, Madhab, PrayerTimes, type CalculationParameters } from 'adhan';

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type PrayerMethod = 'karachi' | 'mwl' | 'umm' | 'egyptian';
export type AsrMadhab = 'hanafi' | 'standard';

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
 * How long each prohibited time lasts, in minutes. The Hanafi sources give
 * ranges (about 15 to 20 after sunrise, 5 to 10 before Dhuhr, 20 to 40 before
 * sunset), so the longer end of each is used: it is safer to wait a few
 * minutes too long than to pray inside the forbidden time.
 */
export const PROHIBITED_MINUTES = { sunrise: 20, zenith: 10, sunset: 30 } as const;

export const METHOD_OPTIONS: Array<{ value: PrayerMethod; label: string }> = [
  { value: 'karachi', label: 'Karachi (University of Islamic Sciences)' },
  { value: 'mwl', label: 'Muslim World League' },
  { value: 'umm', label: 'Umm al-Qura (Makkah)' },
  { value: 'egyptian', label: 'Egyptian General Authority' }
];

function paramsFor(method: PrayerMethod, madhab: AsrMadhab): CalculationParameters {
  const params =
    method === 'mwl'
      ? CalculationMethod.MuslimWorldLeague()
      : method === 'umm'
        ? CalculationMethod.UmmAlQura()
        : method === 'egyptian'
          ? CalculationMethod.Egyptian()
          : CalculationMethod.Karachi();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function shiftMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * The five prayer windows for one day, plus the three prohibited times.
 * Everything is calculated on the device from the place's coordinates, so it
 * needs no internet and no account.
 *
 * Each prayer's time ends where the next begins, except that Fajr ends at
 * sunrise and Isha ends at the next day's Fajr.
 *
 * Prohibited times (Hanafi): from sunrise until the sun has risen a spear's
 * length, while the sun is at its highest just before Dhuhr, and while the sun
 * is setting just before Maghrib. Sunset is taken as the start of Maghrib.
 */
export function computeDay(
  date: Date,
  lat: number,
  lng: number,
  method: PrayerMethod,
  madhab: AsrMadhab
): DayPrayers {
  const coords = new Coordinates(lat, lng);
  const params = paramsFor(method, madhab);
  const today = new PrayerTimes(coords, date, params);
  const tomorrow = new PrayerTimes(coords, shiftDays(date, 1), params);
  const yesterday = new PrayerTimes(coords, shiftDays(date, -1), params);

  return {
    windows: [
      { key: 'fajr', name: 'Fajr', start: today.fajr, end: today.sunrise },
      { key: 'dhuhr', name: 'Dhuhr', start: today.dhuhr, end: today.asr },
      { key: 'asr', name: 'Asr', start: today.asr, end: today.maghrib },
      { key: 'maghrib', name: 'Maghrib', start: today.maghrib, end: today.isha },
      { key: 'isha', name: 'Isha', start: today.isha, end: tomorrow.fajr }
    ],
    prevIshaStart: yesterday.isha,
    prohibited: [
      {
        key: 'sunrise',
        name: 'Sunrise',
        start: today.sunrise,
        end: shiftMinutes(today.sunrise, PROHIBITED_MINUTES.sunrise),
        detail: 'The sun is rising. No prayer at all, not even a make-up prayer, until it has fully risen.'
      },
      {
        key: 'zenith',
        name: 'Sun at its highest',
        start: shiftMinutes(today.dhuhr, -PROHIBITED_MINUTES.zenith),
        end: today.dhuhr,
        detail: 'The sun is at its highest point. No prayer at all until Dhuhr begins.'
      },
      {
        key: 'sunset',
        name: 'Sunset',
        start: shiftMinutes(today.maghrib, -PROHIBITED_MINUTES.sunset),
        end: today.maghrib,
        detail:
          'The sun is setting. No voluntary or make-up prayers until Maghrib. Today\u2019s Asr, if not yet prayed, is still valid but disliked.'
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
