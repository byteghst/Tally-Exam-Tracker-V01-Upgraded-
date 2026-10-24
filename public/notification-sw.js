// Loaded into the generated service worker (see `importScripts` in vite.config.ts).
// Tapping a reminder brings the open Tally window forward and asks it to go to
// the matching screen; if the app is closed it opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || '/dashboard';

  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(scope)) {
          await client.focus();
          client.postMessage({ type: 'tally-open', path });
          return;
        }
      }
      await self.clients.openWindow(scope);
    })()
  );
});
