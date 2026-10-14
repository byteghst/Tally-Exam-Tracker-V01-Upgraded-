import { LocalNotifications } from '@capacitor/local-notifications';
import { planNotifications, type PlannedNotification } from './scheduling';
import { hashToInt32 } from './hash';
import type { Exam, NotificationPrefs, Task } from '@/types';

/** Channel every Tally reminder is posted to (high priority: sound + heads-up banner). */
export const REMINDER_CHANNEL_ID = 'tally-reminders';
/** White Tally glyph added to the Android project at build time (see ci/force-signing.sh). */
const SMALL_ICON = 'ic_stat_tally';
/** Persimmon: tints the notification icon and the phone's notification light. */
const ICON_COLOR = '#D94F2D';
/** Dispatch this on `window` to make the sync hook re-plan and re-schedule right away. */
export const RESYNC_EVENT = 'tally:resync-notifications';

const ASKED_KEY = 'tally-notification-permission-asked';

export type ExactAlarmState = 'granted' | 'denied' | 'unknown';

export interface NativeReminderStatus {
  permission: boolean;
  exactAlarms: ExactAlarmState;
  scheduledCount: number;
  next?: { title: string; body: string; at: Date };
}

export async function requestNativeNotificationPermission(): Promise<boolean> {
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

export async function getNativeNotificationPermission(): Promise<boolean> {
  const result = await LocalNotifications.checkPermissions();
  return result.display === 'granted';
}

/**
 * Asks for notification permission one time, automatically, the first time
 * there is actually something to remind about — instead of relying on the
 * person to find the Enable button in Settings. Without this, reminders
 * silently never appear on Android 13+.
 */
async function askForPermissionOnce(): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  if (current.display !== 'prompt' && current.display !== 'prompt-with-rationale') return false; // blocked
  try {
    if (localStorage.getItem(ASKED_KEY)) return false;
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // storage unavailable: fall through and ask
  }
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

/**
 * Whether Android lets Tally fire alarms at the exact minute. When this is
 * off, Android may hold reminders back by several minutes.
 */
export async function getExactAlarmState(): Promise<ExactAlarmState> {
  try {
    const result = await LocalNotifications.checkExactNotificationSetting();
    return result.exact_alarm === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unknown';
  }
}

/** Opens the system screen where "Alarms & reminders" can be allowed for Tally. */
export async function openExactAlarmSettings(): Promise<void> {
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    // not supported on this Android version
  }
}

async function ensureReminderChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Reminders',
      description: 'Exam and task reminders',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: ICON_COLOR
    });
  } catch {
    // already exists (channels can't be changed once created) or unsupported
  }
}

// ---------------------------------------------------------------------------
// Syncing
// ---------------------------------------------------------------------------

let syncChain: Promise<unknown> = Promise.resolve();
let lastSignature = '';
let lastScheduled: { count: number; next?: { title: string; body: string; at: Date } } = { count: 0 };

function summarize(planned: PlannedNotification[]) {
  lastScheduled = {
    count: planned.length,
    next: planned[0] ? { title: planned[0].title, body: planned[0].body, at: planned[0].fireAt } : undefined
  };
}

async function applySync(exams: Exam[], tasks: Task[], prefs: NotificationPrefs): Promise<void> {
  const planned = planNotifications(exams, tasks, prefs);

  let granted = await getNativeNotificationPermission().catch(() => false);
  if (!granted && planned.length > 0) granted = await askForPermissionOnce().catch(() => false);
  if (!granted) {
    // Can't show anything. Leave whatever is already scheduled untouched, so a
    // denied/failed permission check never wipes reminders.
    lastScheduled = { count: 0 };
    return;
  }

  await ensureReminderChannel();

  // Numeric ids for the OS; nudge on the (very unlikely) hash collision.
  const byId = new Map<number, PlannedNotification>();
  for (const p of planned) {
    let id = hashToInt32(p.key);
    while (byId.has(id)) id = (id + 1) % 2147483647;
    byId.set(id, p);
  }

  const signature = JSON.stringify([...byId].map(([id, p]) => [id, p.fireAt.getTime(), p.title, p.body, p.path]));
  const pending = await LocalNotifications.getPending();

  // Already exactly what we want: don't churn the alarms.
  if (signature === lastSignature && pending.notifications.length === byId.size) {
    summarize(planned);
    return;
  }

  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }

  if (byId.size > 0) {
    await LocalNotifications.schedule({
      notifications: [...byId].map(([id, p]) => ({
        id,
        title: p.title,
        body: p.body,
        channelId: REMINDER_CHANNEL_ID,
        smallIcon: SMALL_ICON,
        iconColor: ICON_COLOR,
        // allowWhileIdle: deliver even while the phone is in Doze (idle) mode;
        // without it Android can hold reminders back for a long time.
        schedule: { at: p.fireAt, allowWhileIdle: true },
        extra: { path: p.path }
      }))
    });
  }

  lastSignature = signature;
  summarize(planned);
}

/**
 * Rebuilds the full set of scheduled reminders from current data. Calls are
 * queued and run one at a time so two quick edits can never interleave their
 * cancel/schedule steps. Only call this once exams, tasks and settings have
 * finished loading — an empty list here means "nothing to remind", and the
 * old reminders will be cancelled.
 */
export function syncNativeReminders(exams: Exam[], tasks: Task[], prefs: NotificationPrefs): Promise<void> {
  const run = syncChain.then(() => applySync(exams, tasks, prefs));
  syncChain = run.catch(() => undefined);
  return run;
}

export async function getNativeReminderStatus(): Promise<NativeReminderStatus> {
  const [permission, exactAlarms] = await Promise.all([
    getNativeNotificationPermission().catch(() => false),
    getExactAlarmState()
  ]);
  return { permission, exactAlarms, scheduledCount: lastScheduled.count, next: lastScheduled.next };
}

export async function sendTestNativeNotification(): Promise<void> {
  await ensureReminderChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: hashToInt32(`test-${Date.now()}`),
        title: 'Tally',
        body: 'Notifications are working.',
        channelId: REMINDER_CHANNEL_ID,
        smallIcon: SMALL_ICON,
        iconColor: ICON_COLOR,
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
        extra: { path: '/settings' }
      }
    ]
  });
}

// ---------------------------------------------------------------------------
// Tapping a notification opens the matching screen
// ---------------------------------------------------------------------------

let tapNavigate: ((path: string) => void) | null = null;
let tapListenerAdded = false;

export function registerNotificationTapHandler(navigate: (path: string) => void): void {
  tapNavigate = navigate;
  if (tapListenerAdded) return;
  tapListenerAdded = true;
  void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const path = (event.notification.extra as { path?: unknown } | undefined)?.path;
    if (typeof path === 'string' && path.startsWith('/') && tapNavigate) tapNavigate(path);
  });
}
