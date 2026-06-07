// Kill-switch service worker.
//
// The app no longer ships a real service worker — PWA precaching was removed during the
// Cloudflare/OpenNext migration because the webpack build it required broke Next.js
// Server Actions. This file exists only to evict any previously registered
// serwist/next-pwa worker from users' browsers: it clears all caches, unregisters
// itself, and reloads open tabs onto the live, network-served app.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      } catch {
        // ignore cache cleanup errors
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});
