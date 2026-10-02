import type { Exam, NotificationPrefs, Task } from '@/types';
import { parseISODate } from '@/lib/dates';

export type ReminderKind = 'exam' | 'task';

export interface ReminderItem {
  /** Composite id, e.g. "exam-<uuid>" — stable per entity. */
  id: string;
  kind: ReminderKind;
  entityId: string;
  title: string;
  body: string;
  fireAt: Date;
  targetAt: Date;
}

/** A notification ready to hand to the operating system. */
export interface PlannedNotification {
  /** Stable string id; hashed into the numeric id the OS needs. */
  key: string;
  title: string;
  body: string;
  fireAt: Date;
  /** In-app route opened when the notification is tapped. */
  path: string;
}

const DEFAULT_HOUR = 9;
/** Evening-before exam heads-up time (24h clock). */
const EVENING_HOUR = 20;
/** Morning briefing time (24h clock). */
const MORNING_HOUR = 8;
/** Only plan automatic reminders this far ahead; the plan is rebuilt on every app open. */
const AUTO_HORIZON_DAYS = 14;
/** How many upcoming mornings get a briefing. */
const BRIEFING_DAYS = 7;
/** Android caps how many alarms an app can hold; stay far below it. */
export const MAX_PLANNED = 60;

const DAY_MS = 86_400_000;
const TYPE_LABEL: Record<Exam['type'], string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

function combineDateAndTime(dateISO: string, time: string | undefined): Date {
  const d = parseISODate(dateISO);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(DEFAULT_HOUR, 0, 0, 0);
  }
  return d;
}

function clock(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

function isOpenTask(t: Task): boolean {
  return t.status !== 'completed' && t.status !== 'archived' && t.status !== 'skipped';
}

/** Builds the reminders set on individual exams/tasks ("30 minutes before") that fire in the future. */
export function getFutureReminders(exams: Exam[], tasks: Task[], now: Date = new Date()): ReminderItem[] {
  const items: ReminderItem[] = [];

  for (const e of exams) {
    if (!e.reminderMinutesBefore || e.status !== 'upcoming') continue;
    const targetAt = combineDateAndTime(e.date, e.startTime);
    const fireAt = new Date(targetAt.getTime() - e.reminderMinutesBefore * 60_000);
    if (fireAt.getTime() <= now.getTime()) continue;
    items.push({
      id: `exam-${e.id}`,
      kind: 'exam',
      entityId: e.id,
      title: e.name,
      body: `Exam in ${minutesLabel(e.reminderMinutesBefore)}${e.startTime ? ` · ${clock(targetAt)}` : ''}`,
      fireAt,
      targetAt
    });
  }

  for (const t of tasks) {
    if (!t.reminderMinutesBefore || !t.date || !isOpenTask(t)) continue;
    const targetAt = combineDateAndTime(t.date, t.time);
    const fireAt = new Date(targetAt.getTime() - t.reminderMinutesBefore * 60_000);
    if (fireAt.getTime() <= now.getTime()) continue;
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      entityId: t.id,
      title: t.name,
      body: `Task in ${minutesLabel(t.reminderMinutesBefore)}${t.time ? ` · ${clock(targetAt)}` : ''}`,
      fireAt,
      targetAt
    });
  }

  return items.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/**
 * Reminders whose fire time has already passed (within a grace window) and
 * that haven't already been shown. Used by the web checker, which can only
 * act while the app is actually open.
 */
export function getDueReminders(
  exams: Exam[],
  tasks: Task[],
  alreadyNotifiedIds: string[],
  now: Date = new Date(),
  graceMinutes = 30
): ReminderItem[] {
  const notified = new Set(alreadyNotifiedIds);
  const graceMs = graceMinutes * 60_000;
  return getAllReminders(exams, tasks).filter((item) => {
    if (notified.has(item.id)) return false;
    const diff = now.getTime() - item.fireAt.getTime();
    return diff >= 0 && diff <= graceMs;
  });
}

function getAllReminders(exams: Exam[], tasks: Task[]): ReminderItem[] {
  return getFutureReminders(exams, tasks, new Date(0));
}

/**
 * The complete list of notifications that should be scheduled with the OS:
 *  1. reminders set on individual exams/tasks,
 *  2. an evening-before heads-up for each upcoming exam (8 PM the night before),
 *  3. a morning briefing (8 AM) on days that have an exam or tasks due.
 * (2) and (3) need no per-item setup; each can be switched off in Settings,
 * and a missing setting counts as ON.
 */
export function planNotifications(
  exams: Exam[],
  tasks: Task[],
  prefs: NotificationPrefs,
  now: Date = new Date()
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const horizon = now.getTime() + AUTO_HORIZON_DAYS * DAY_MS;

  // 1) Custom reminders
  for (const r of getFutureReminders(prefs.exams ? exams : [], prefs.tasks ? tasks : [], now)) {
    out.push({
      key: r.id,
      title: r.kind === 'exam' ? `Exam: ${r.title}` : `Task: ${r.title}`,
      body: r.body,
      fireAt: r.fireAt,
      path: r.kind === 'exam' ? `/exams/${r.entityId}` : '/tasks'
    });
  }

  // 2) Evening before each upcoming exam
  if (prefs.exams && prefs.examEveningBefore !== false) {
    for (const e of exams) {
      if (e.status !== 'upcoming') continue;
      const eve = parseISODate(e.date);
      eve.setDate(eve.getDate() - 1);
      eve.setHours(EVENING_HOUR, 0, 0, 0);
      if (eve.getTime() <= now.getTime() || eve.getTime() > horizon) continue;
      out.push({
        key: `exam-eve-${e.id}`,
        title: `Tomorrow: ${e.name}`,
        body: `${TYPE_LABEL[e.type]} exam${e.startTime ? ` at ${clock(combineDateAndTime(e.date, e.startTime))}` : ''}`,
        fireAt: eve,
        path: `/exams/${e.id}`
      });
    }
  }

  // 3) Morning briefing
  if (prefs.morningBriefing !== false && (prefs.exams || prefs.tasks)) {
    for (let i = 0; i < BRIEFING_DAYS; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, MORNING_HOUR, 0, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      const iso = isoOf(at);
      const dayExams = prefs.exams
        ? exams
            .filter((e) => e.status === 'upcoming' && e.date === iso)
            .sort(
              (a, b) =>
                combineDateAndTime(a.date, a.startTime).getTime() - combineDateAndTime(b.date, b.startTime).getTime()
            )
        : [];
      const dayTasks = prefs.tasks ? tasks.filter((t) => t.date === iso && isOpenTask(t)) : [];
      if (dayExams.length === 0 && dayTasks.length === 0) continue;

      const parts: string[] = [];
      if (dayExams.length > 0) {
        const first = dayExams[0];
        const when = first.startTime ? ` at ${clock(combineDateAndTime(first.date, first.startTime))}` : '';
        parts.push(
          dayExams.length === 1
            ? `Exam: ${first.name}${when}`
            : `${dayExams.length} exams today, first: ${first.name}${when}`
        );
      }
      if (dayTasks.length > 0) parts.push(`${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'} due`);

      out.push({
        key: `brief-${iso}`,
        title: 'Today on Tally',
        body: parts.join(' · '),
        fireAt: at,
        path: dayExams.length === 1 && dayTasks.length === 0 ? `/exams/${dayExams[0].id}` : '/dashboard'
      });
    }
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_PLANNED);
}
