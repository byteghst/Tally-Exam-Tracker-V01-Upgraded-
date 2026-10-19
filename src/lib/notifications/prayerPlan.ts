import { toISODate } from '@/lib/dates';
import { computeDay, formatClock } from '@/lib/prayer/times';
import type { PlannedNotification } from './scheduling';

/** Which Android notification channel a planned notification is posted to. */
export type NotificationChannelKind = 'reminders' | 'prayer' | 'prohibited';

export interface PlannedPrayerNotification extends PlannedNotification {
  channel: Exclude<NotificationChannelKind, 'reminders'>;
}

export interface PrayerReminderPrefs {
  /** "Asr has begun" when a prayer's time starts. */
  remindStart: boolean;
  /** "10 minutes left" before a prayer's time runs out. */
  remindEnding: boolean;
  /** A special alert when a prohibited time begins. */
  remindProhibited: boolean;
}

/**
 * Prayer times are worked out on the phone, so reminders can be planned a week
 * ahead and still be right. They are re-planned on every app open, so the app
 * only needs opening once in a while to keep them topped up.
 */
const DAYS_AHEAD = 7;
/** How long before a prayer's time runs out the warning fires. */
export const ENDING_WARNING_MINUTES = 10;
/** Prayers shorter than this get no warning: it would fire right after the start. */
const MIN_GAP_MS = 5 * 60_000;

const PATH = '/dashboard?prayer=1';

function prohibitedBody(key: 'sunrise' | 'zenith' | 'sunset', endsAt: string): string {
  if (key === 'sunrise') return `Sunrise. Do not pray until ${endsAt}.`;
  if (key === 'zenith') return `The sun is at its highest. Do not pray until Dhuhr begins at ${endsAt}.`;
  return `The sun is setting. No prayer until ${endsAt}. If you have not prayed Asr yet, pray it now.`;
}

/**
 * The prayer notifications to schedule with the OS for the next week:
 *  - when each prayer's time begins,
 *  - ten minutes before it runs out (skipped for a prayer already marked as
 *    prayed in the tracker),
 *  - when each of the three prohibited times begins, posted to its own
 *    high-priority channel with a red light and icon so it stands out.
 *
 * `prayed` holds "yyyy-mm-dd:prayer" entries from the tracker.
 */
export function planPrayerNotifications(
  lat: number,
  lng: number,
  prefs: PrayerReminderPrefs,
  prayed: Set<string>,
  now: Date = new Date()
): PlannedPrayerNotification[] {
  if (!prefs.remindStart && !prefs.remindEnding && !prefs.remindProhibited) return [];
  const out: PlannedPrayerNotification[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = toISODate(date);
    const day = computeDay(date, lat, lng);

    for (const w of day.windows) {
      if (prefs.remindStart && w.start.getTime() > now.getTime()) {
        out.push({
          key: `prayer-start-${iso}-${w.key}`,
          title: `${w.name} has begun`,
          body: `Time ends at ${formatClock(w.end)}`,
          fireAt: w.start,
          path: PATH,
          channel: 'prayer'
        });
      }

      if (prefs.remindEnding && !prayed.has(`${iso}:${w.key}`)) {
        const warnAt = new Date(w.end.getTime() - ENDING_WARNING_MINUTES * 60_000);
        if (warnAt.getTime() > now.getTime() && warnAt.getTime() - w.start.getTime() >= MIN_GAP_MS) {
          out.push({
            key: `prayer-end-${iso}-${w.key}`,
            title: `${w.name}: ${ENDING_WARNING_MINUTES} minutes left`,
            body: `Time runs out at ${formatClock(w.end)}. Pray now.`,
            fireAt: warnAt,
            path: PATH,
            channel: 'prayer'
          });
        }
      }
    }

    if (prefs.remindProhibited) {
      for (const p of day.prohibited) {
        if (p.start.getTime() <= now.getTime()) continue;
        out.push({
          key: `prohibited-${iso}-${p.key}`,
          title: '\u26D4 Prohibited time \u2014 do not pray',
          body: prohibitedBody(p.key, formatClock(p.end)),
          fireAt: p.start,
          path: PATH,
          channel: 'prohibited'
        });
      }
    }
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
