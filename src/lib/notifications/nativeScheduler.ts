import { LocalNotifications } from '@capacitor/local-notifications';
import { getFutureReminders } from './scheduling';
import { hashToInt32 } from './hash';
import type { Exam, Task } from '@/types';

export async function requestNativeNotificationPermission(): Promise<boolean> {
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

export async function getNativeNotificationPermission(): Promise<boolean> {
  const result = await LocalNotifications.checkPermissions();
  return result.display === 'granted';
}

/**
 * Cancels everything currently scheduled and reschedules from scratch based
 * on current exam/task data.
 */
export async function syncNativeReminders(exams: Exam[], tasks: Task[]): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }

  const items = getFutureReminders(exams, tasks);
  if (items.length === 0) return;

  await LocalNotifications.schedule({
    notifications: items.map((item) => ({
      id: hashToInt32(item.id),
      title: item.kind === 'exam' ? `Exam: ${item.title}` : `Task: ${item.title}`,
      body: item.body,
      schedule: { at: item.fireAt }
    }))
  });
}

export async function sendTestNativeNotification(): Promise<void> {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: hashToInt32(`test-${Date.now()}`),
        title: 'Tally',
        body: 'Notifications are working.',
        schedule: { at: new Date(Date.now() + 2000) }
      }
    ]
  });
}
