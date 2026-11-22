import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQuoteStore } from '@/store/quoteStore';
import { isQuotePushEnabled, registerPush } from '@/lib/push';

/**
 * Keeps this device registered for the daily quote notification while someone is signed in,
 * and opens the quote popup by itself, once, when the app is opened and a new quote has arrived.
 */
export function usePushNotifications(): void {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    if (isQuotePushEnabled()) void registerPush();
    void useQuoteStore.getState().checkForNew();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void useQuoteStore.getState().checkForNew();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId]);
}
