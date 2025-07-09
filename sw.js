const cacheName = 'kanha-library-cache-v1';
const assetsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/login.css',
  // add other CSS/JS/image files if needed
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
