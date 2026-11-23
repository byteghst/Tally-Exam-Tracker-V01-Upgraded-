import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase/client';
import { useQuoteStore } from '@/store/quoteStore';

/**
 * Remote notifications (Firebase Cloud Messaging) for the daily quote. Android app only:
 * the web version has no push, it shows the quote popup when the app is opened.
 */

const TOKEN_KEY = 'tally-push-token';
const OFF_KEY = 'tally-quote-push-off';
export const QUOTE_CHANNEL_ID = 'tally-quote';

export type PushResult = 'registered' | 'denied' | 'unsupported' | 'error';

export function pushSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isQuotePushEnabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== '1';
  } catch {
    return true;
  }
}

function setQuotePushPreference(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, '1');
  } catch {
    /* the switch still works for this session */
  }
}

function rememberToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to do */
  }
}

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let listenersReady = false;

async function attachListeners(): Promise<void> {
  if (listenersReady) return;
  listenersReady = true;

  await PushNotifications.addListener('registration', async (t) => {
    rememberToken(t.value);
    // If this fails (offline, signed out) it is simply tried again on the next app start.
    const { error } = await supabase.rpc('register_push_token', { p_token: t.value, p_platform: 'android' });
    if (error) console.warn('Could not save the push token', error.message);
  });

  await PushNotifications.addListener('registrationError', (e) => {
    console.warn('Push registration failed', e.error);
  });

  // The app is open when it arrives: show the quote right away instead of a tray notification.
  await PushNotifications.addListener('pushNotificationReceived', (n) => {
    if (n.data?.type === 'quote') void useQuoteStore.getState().openLatest();
  });

  // The person tapped the notification: open the quote popup over wherever the app lands.
  await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    if (a.notification.data?.type === 'quote') void useQuoteStore.getState().openLatest();
  });
}

async function ensureChannel(): Promise<void> {
  try {
    await PushNotifications.createChannel({
      id: QUOTE_CHANNEL_ID,
      name: 'Daily quote',
      description: 'One motivational quote each morning',
      importance: 4,
      visibility: 1,
      vibration: true
    });
  } catch {
    /* an existing channel is fine */
  }
}

/** Asks for permission if needed, then (re)registers this device so the server can reach it. */
export async function registerPush(): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported';
  try {
    await ensureChannel();
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return 'denied';
    await attachListeners();
    await PushNotifications.register();
    return 'registered';
  } catch (e) {
    console.warn('Push setup failed', e);
    return 'error';
  }
}

/** Removes this device from the server's list (sign out, or the switch turned off). */
export async function unregisterPush(): Promise<void> {
  const token = storedToken();
  if (token) {
    try {
      await supabase.rpc('unregister_push_token', { p_token: token });
    } catch {
      /* the server also drops tokens that Firebase reports as dead */
    }
  }
  rememberToken(null);
  if (pushSupported()) {
    try {
      await PushNotifications.unregister();
    } catch {
      /* not registered */
    }
  }
}

export async function enableQuotePush(): Promise<PushResult> {
  const result = await registerPush();
  if (result === 'registered') setQuotePushPreference(true);
  return result;
}

export async function disableQuotePush(): Promise<void> {
  setQuotePushPreference(false);
  await unregisterPush();
}
