import { Capacitor } from '@capacitor/core';

/**
 * A service worker exists purely to make the browser-based PWA installable
 * and offline-capable. Inside the Capacitor native app it serves no
 * purpose — the WebView already loads everything from local disk — and a
 * stray registration there can persist across app updates (WebView storage
 * usually survives an APK reinstall) and end up serving an old cached JS
 * bundle indefinitely, which looks exactly like "my data isn't updating"
 * even though the data itself is fine.
 */
export async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (Capacitor.isNativePlatform()) {
    // Clean up any worker that may have been registered by an earlier
    // build (before this fix existed) and is still sitting in this
    // WebView's storage.
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    return;
  }

  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
}
