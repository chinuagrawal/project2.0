const cacheName = 'kanha-library-cache-v2'; // ✅ update version when deploying new changes
const assetsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/login.css',
  // Add more assets if needed (JS, images, etc.)
];

// Install: cache the essential files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== cacheName)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Clone and store the response in cache
        const resClone = res.clone();
        caches.open(cacheName).then((cache) => {
          cache.put(event.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
