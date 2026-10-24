import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '@/store/authStore';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePrayerStore } from '@/store/prayerStore';
import { usePrayerLogStore } from '@/store/prayerLogStore';
import { findCity } from '@/lib/prayer/cities';
import {
  RESYNC_EVENT,
  registerNotificationTapHandler,
  syncNativeReminders
} from '@/lib/notifications/nativeScheduler';
import { planPrayerNotifications } from '@/lib/notifications/prayerPlan';
import { MAX_REMEMBERED, checkAndFireWebReminders } from '@/lib/notifications/webChecker';

const WEB_CHECK_INTERVAL_MS = 60_000;
const SYNC_DEBOUNCE_MS = 400;

/**
 * Keeps scheduled reminders in sync with current exam/task data, and with the
 * prayer reminders (prayer start, ten minutes left, prohibited times).
 *
 * Native: hands the full reminder plan to the OS whenever the data or the
 * notification settings change, when the app comes back to the foreground,
 * and when Settings asks for it (after allowing notifications, for example).
 * It never runs until exams, tasks and settings have actually loaded — an
 * empty, not-yet-loaded list must not be mistaken for "nothing to remind
 * about", which would cancel every scheduled reminder.
 *
 * Web: re-checks on an interval and whenever the tab regains visibility,
 * since that's the only time web notifications can act at all. Notifications
 * are shown through the service worker (phones refuse the plain constructor),
 * and tapping one brings this window forward and opens the matching screen.
 * (Prayer reminders are Android-only: a web page can't wake up at prayer time.)
 */
export function useNotificationSync() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const exams = useExamStore((s) => s.exams);
  const examsLoaded = useExamStore((s) => s.loaded);
  const tasks = useTaskStore((s) => s.tasks);
  const tasksLoaded = useTaskStore((s) => s.loaded);
  const { settings, updateSettings, loaded: settingsLoaded } = useSettingsStore();
  const prefs = settings.notificationPrefs;
  const cityName = usePrayerStore((s) => s.cityName);
  const remindStart = usePrayerStore((s) => s.remindStart);
  const remindEnding = usePrayerStore((s) => s.remindEnding);
  const remindProhibited = usePrayerStore((s) => s.remindProhibited);
  const prayerLog = usePrayerLogStore((s) => s.days);
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

  // ---- Web: tapping a notification opens the matching screen ----
  useEffect(() => {
    if (isNative || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: unknown } | null;
      if (data?.type === 'tally-open' && typeof data.path === 'string') navigateRef.current(data.path);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
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

  // ---- Native: the prayer tracker is read once signed in, so a prayer that is
  // already marked as prayed gets no "10 minutes left" warning ----
  useEffect(() => {
    if (isNative && userId) void usePrayerLogStore.getState().hydrate();
  }, [isNative, userId]);

  // ---- Native: schedule ----
  const ready = examsLoaded && tasksLoaded && settingsLoaded;
  useEffect(() => {
    if (!isNative || !ready) return;
    const timer = setTimeout(() => {
      const city = findCity(cityName);
      const prayed = new Set<string>();
      for (const [date, keys] of Object.entries(prayerLog)) {
        for (const key of keys) prayed.add(`${date}:${key}`);
      }
      const prayerPlan = planPrayerNotifications(
        city.lat,
        city.lng,
        { remindStart, remindEnding, remindProhibited },
        prayed
      );
      syncNativeReminders(exams, tasks, prefs, prayerPlan).catch(() => {
        // scheduling is best-effort; a failure here shouldn't break the app
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isNative, ready, exams, tasks, prefs, resyncTick, cityName, remindStart, remindEnding, remindProhibited, prayerLog]);

  // ---- Web: check while the app is open ----
  useEffect(() => {
    // Wait for settings too: the list of already-shown reminders lives there,
    // and checking before it loads would show old reminders a second time.
    if (isNative || !settingsLoaded) return;

    function check() {
      void checkAndFireWebReminders(
        exams,
        tasks,
        settingsRef.current.notificationPrefs,
        settingsRef.current.notifiedReminderIds,
        (firedIds) => {
          updateSettings({
            notifiedReminderIds: [...settingsRef.current.notifiedReminderIds, ...firedIds].slice(-MAX_REMEMBERED)
          });
        }
      );
    }

    check();
    const interval = setInterval(check, WEB_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, settingsLoaded, exams, tasks, prefs]);
}
