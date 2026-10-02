import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  RESYNC_EVENT,
  registerNotificationTapHandler,
  syncNativeReminders
} from '@/lib/notifications/nativeScheduler';
import { checkAndFireWebReminders } from '@/lib/notifications/webChecker';
import type { Exam, Task } from '@/types';

const WEB_CHECK_INTERVAL_MS = 60_000;
const SYNC_DEBOUNCE_MS = 400;

// Stable empty lists (a fresh `[]` every render would re-trigger the effects below).
const NO_EXAMS: Exam[] = [];
const NO_TASKS: Task[] = [];

/**
 * Keeps scheduled reminders in sync with current exam/task data.
 *
 * Native: hands the full reminder plan to the OS whenever the data or the
 * notification settings change, when the app comes back to the foreground,
 * and when Settings asks for it (after allowing notifications, for example).
 * It never runs until exams, tasks and settings have actually loaded — an
 * empty, not-yet-loaded list must not be mistaken for "nothing to remind
 * about", which would cancel every scheduled reminder.
 *
 * Web: re-checks on an interval and whenever the tab regains visibility,
 * since that's the only time web notifications can act at all.
 */
export function useNotificationSync() {
  const navigate = useNavigate();
  const exams = useExamStore((s) => s.exams);
  const examsLoaded = useExamStore((s) => s.loaded);
  const tasks = useTaskStore((s) => s.tasks);
  const tasksLoaded = useTaskStore((s) => s.loaded);
  const { settings, updateSettings, loaded: settingsLoaded } = useSettingsStore();
  const prefs = settings.notificationPrefs;
  const isNative = Capacitor.isNativePlatform();
  const [resyncTick, setResyncTick] = useState(0);

  // kept in refs so callbacks below always read the latest values without
  // needing to be recreated
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // ---- Native: tapping a notification opens the matching screen ----
  useEffect(() => {
    if (!isNative) return;
    registerNotificationTapHandler((path) => navigateRef.current(path));
  }, [isNative]);

  // ---- Native: re-plan when the app returns to the foreground or Settings asks ----
  useEffect(() => {
    if (!isNative) return;
    const bump = () => setResyncTick((n) => n + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump();
    };
    window.addEventListener(RESYNC_EVENT, bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(RESYNC_EVENT, bump);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isNative]);

  // ---- Native: schedule ----
  const ready = examsLoaded && tasksLoaded && settingsLoaded;
  useEffect(() => {
    if (!isNative || !ready) return;
    const timer = setTimeout(() => {
      syncNativeReminders(exams, tasks, prefs).catch(() => {
        // scheduling is best-effort; a failure here shouldn't break the app
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isNative, ready, exams, tasks, prefs, resyncTick]);

  // ---- Web: check while the app is open ----
  const eligibleExams = useMemo(() => (prefs.exams ? exams : NO_EXAMS), [prefs.exams, exams]);
  const eligibleTasks = useMemo(() => (prefs.tasks ? tasks : NO_TASKS), [prefs.tasks, tasks]);

  useEffect(() => {
    // Wait for settings too: the list of already-shown reminders lives there,
    // and checking before it loads would show old reminders a second time.
    if (isNative || !settingsLoaded) return;

    function check() {
      checkAndFireWebReminders(eligibleExams, eligibleTasks, settingsRef.current.notifiedReminderIds, (firedIds) => {
        updateSettings({
          notifiedReminderIds: [...settingsRef.current.notifiedReminderIds, ...firedIds]
        });
      });
    }

    check();
    const interval = setInterval(check, WEB_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, settingsLoaded, eligibleExams, eligibleTasks]);
}
