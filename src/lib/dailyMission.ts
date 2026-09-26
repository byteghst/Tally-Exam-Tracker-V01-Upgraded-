import type { Task, Exam } from '@/types';
import { todayISO } from '@/lib/dates';

export interface MissionItem {
  id: string;
  label: string;
  done: boolean;
}

interface DailyMissionInput {
  tasks: Task[];
  exams: Exam[];
}

/**
 * Two item types, each with a genuine, unambiguous "done" signal already in
 * the data: today's scheduled tasks, and exams that happened but haven't had
 * a result recorded yet (still sitting as "upcoming" on or after their date).
 */
export function computeDailyMission({ tasks, exams }: DailyMissionInput): MissionItem[] {
  const today = todayISO();
  const items: MissionItem[] = [];

  const todaysTasks = tasks.filter((t) => t.date === today);
  if (todaysTasks.length > 0) {
    items.push({
      id: 'tasks',
      label: `Complete ${todaysTasks.length} task${todaysTasks.length === 1 ? '' : 's'}`,
      done: todaysTasks.every((t) => t.status === 'completed')
    });
  }

  const pendingResults = exams.filter((e) => e.status === 'upcoming' && e.date <= today);
  if (pendingResults.length > 0) {
    items.push({
      id: 'record-results',
      label: `Record result${pendingResults.length === 1 ? '' : 's'} for ${pendingResults.length} exam${pendingResults.length === 1 ? '' : 's'}`,
      done: false
    });
  }

  return items;
}
