// AuraPulse Service Worker for Standalone Mobile PWA installation
const CACHE_NAME = 'aurapulse-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle standard network requests
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
