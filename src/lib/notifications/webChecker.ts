import { getDueReminders } from './scheduling';
import type { Exam, Task } from '@/types';

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
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function checkAndFireWebReminders(
  exams: Exam[],
  tasks: Task[],
  alreadyNotifiedIds: string[],
  onFired: (newlyFiredIds: string[]) => void
): void {
  if (!isWebNotificationSupported() || Notification.permission !== 'granted') return;
  const due = getDueReminders(exams, tasks, alreadyNotifiedIds);
  if (due.length === 0) return;

  for (const item of due) {
    new Notification(item.kind === 'exam' ? `Exam: ${item.title}` : `Task: ${item.title}`, {
      body: item.body,
      tag: item.id
    });
  }
  onFired(due.map((d) => d.id));
}

export function sendTestWebNotification(): void {
  if (!isWebNotificationSupported() || Notification.permission !== 'granted') return;
  new Notification('Tally', { body: 'Notifications are working.' });
}
