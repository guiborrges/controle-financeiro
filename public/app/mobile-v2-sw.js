const CACHE_NAME = 'controle-financeiro-mobile-v2-v2';
const CORE_ASSETS = [
  '/app-assets/styles.css',
  '/app-assets/mobile-v2.css',
  '/app-assets/mobile-v2.js',
  '/app-assets/mobile-v2-enhancements.js',
  '/app-assets/modules/mobile-v2/bottom-nav.js',
  '/app-assets/modules/mobile-v2/add-sheet.js',
  '/app-assets/modules/mobile-v2/outflow-form-mobile.js',
  '/app-assets/modules/mobile-v2/mes-atual-mobile.js',
  '/app-assets/modules/mobile-v2/home-screen.js',
  '/app-assets/pwa-icon.svg',
  '/app-assets/pwa-preview.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (!url.pathname.startsWith('/app-assets/')) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response || response.status >= 400 || response.type === 'opaque') return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
      return response;
    }).catch(() => cached))
  );
});
