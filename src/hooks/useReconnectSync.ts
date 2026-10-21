import { useEffect } from 'react';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useDeadlineStore } from '@/store/deadlineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { flushOutbox, pendingCount } from '@/lib/outbox';

/** Wait between attempts to send queued changes that did not get through. */
const RETRY_DELAYS_MS = [1500, 4000, 10000];

/**
 * When the connection comes back (or the app returns to the foreground with
 * changes still waiting): send the changes made offline first, then re-read
 * everything from the account. Realtime only delivers changes made while it
 * was connected, so anything changed on another device during the gap would
 * otherwise be missed. (The study store already does this itself.)
 */
export function useReconnectSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let syncing = false;

    const syncNow = async (): Promise<void> => {
      if (syncing) return;
      syncing = true;
      try {
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
            await flushOutbox(userId);
            if (cancelled || pendingCount(userId) === 0) break;
            if (attempt < RETRY_DELAYS_MS.length) {
              await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
            }
          }
        }
        if (cancelled) return;
        void useExamStore.getState().hydrate();
        void useTaskStore.getState().hydrate();
        void useExamConfigStore.getState().hydrate();
        void useDeadlineStore.getState().hydrate();
        void useSettingsStore.getState().hydrate();
      } finally {
        syncing = false;
      }
    };

    const onOnline = (): void => {
      void syncNow();
    };
    const onVisible = (): void => {
      const userId = useAuthStore.getState().user?.id;
      if (document.visibilityState === 'visible' && userId && pendingCount(userId) > 0) void syncNow();
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
