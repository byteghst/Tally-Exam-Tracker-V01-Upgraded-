import { useEffect } from 'react';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useDeadlineStore } from '@/store/deadlineStore';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * When the connection comes back, re-read everything from the account.
 * Realtime only delivers changes made while it was connected, so anything
 * changed on another device during the gap would otherwise be missed.
 * (The study store already does this itself.)
 */
export function useReconnectSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const refresh = (): void => {
      void useExamStore.getState().hydrate();
      void useTaskStore.getState().hydrate();
      void useExamConfigStore.getState().hydrate();
      void useDeadlineStore.getState().hydrate();
      void useSettingsStore.getState().hydrate();
    };
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, [enabled]);
}
