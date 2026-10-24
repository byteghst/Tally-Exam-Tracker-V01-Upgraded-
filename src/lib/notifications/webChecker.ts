import { planNotifications } from './scheduling';
import { useUIStore } from '@/store/uiStore';
import type { Exam, NotificationPrefs, Task } from '@/types';

const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

/** How long to wait for the service worker before falling back to the plain Notification API. */
const SW_WAIT_MS = 4000;
/** A reminder you set on an exam or task is still shown if the app was closed up to this long past its time. */
const GRACE_REMINDER_MS = 30 * 60_000;
/** The evening heads-up and the morning briefing stay useful for longer. */
const GRACE_DAILY_MS = 6 * 3_600_000;
/** Most notifications remembered as "already shown", so the saved list can't grow forever. */
export const MAX_REMEMBERED = 200;

// Guards against the interval and the visibility event firing the same reminder twice
// before its "already shown" id has been saved.
let checking = false;
const firedThisSession = new Set<string>();

export function isWebNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getWebNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isWebNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestWebNotificationPermission(): Promise<boolean> {
  if (!isWebNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SW_WAIT_MS))
    ]);
  } catch {
    return null;
  }
}

/**
 * Shows one notification. Phones (Android Chrome and installed web apps) refuse
 * `new Notification(...)` outright, so the service worker has to show it. The
 * plain constructor is only a fallback for desktop browsers without a worker.
 */
async function showNotification(title: string, body: string, tag: string, path: string): Promise<boolean> {
  const options: NotificationOptions = { body, tag, icon: ICON, badge: ICON, data: { path } };
  try {
    const registration = await getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
  } catch {
    // fall through to the constructor
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

function isDailyKind(key: string): boolean {
  return key.startsWith('exam-eve-') || key.startsWith('brief-');
}

/**
 * Shows whatever has come due while the app is open: reminders set on exams and
 * tasks, the evening-before heads-up and the morning briefing. Each is shown once.
 * Calls `onFired` with the ids that were really shown, so they can be saved.
 */
export async function checkAndFireWebReminders(
  exams: Exam[],
  tasks: Task[],
  prefs: NotificationPrefs,
  alreadyNotifiedIds: string[],
  onFired: (newlyFiredIds: string[]) => void
): Promise<void> {
  if (!isWebNotificationSupported() || Notification.permission !== 'granted') return;
  if (checking) return;
  checking = true;
  try {
    const now = Date.now();
    const notified = new Set(alreadyNotifiedIds);
    // Plan as if it were a few hours ago, so items whose time has just passed are still in the list.
    const plan = planNotifications(exams, tasks, prefs, new Date(now - GRACE_DAILY_MS));
    const due = plan.filter((item) => {
      if (notified.has(item.key) || firedThisSession.has(item.key)) return false;
      const age = now - item.fireAt.getTime();
      if (age < 0) return false;
      return age <= (isDailyKind(item.key) ? GRACE_DAILY_MS : GRACE_REMINDER_MS);
    });
    if (due.length === 0) return;

    const shown: string[] = [];
    for (const item of due) {
      if (await showNotification(item.title, item.body, item.key, item.path)) {
        shown.push(item.key);
        firedThisSession.add(item.key);
      }
    }
    if (shown.length > 0) onFired(shown);
  } finally {
    checking = false;
  }
}

/** Settings → "Send a test notification". Always tells the person what happened. */
export async function sendTestWebNotification(): Promise<void> {
  const pushToast = useUIStore.getState().pushToast;
  if (!isWebNotificationSupported() || Notification.permission !== 'granted') {
    pushToast('Allow notifications for this site first.', undefined, 'error');
    return;
  }
  const ok = await showNotification('Tally', 'Notifications are working.', 'tally-test', '/dashboard');
  if (ok) {
    pushToast('Test sent. Check your notifications.');
  } else {
    pushToast("Couldn't show a notification. Check this site's notification setting in your browser.", undefined, 'error');
  }
}
