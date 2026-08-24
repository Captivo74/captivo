// ============================================================
// sw.js — Service Worker Captivo
// ============================================================
// v2 : stratégie "réseau en priorité". Le navigateur va TOUJOURS
// chercher la dernière version en ligne d'abord ; le cache ne sert
// que de secours si la connexion est coupée. Ça évite qu'une
// ancienne version du site reste bloquée dans le cache du visiteur
// après une mise à jour (c'était le bug de la v1).

const CACHE_NAME = 'captivo-cache-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/cookie-consent.js',
  '/assets/logo.png',
  '/manifest.json',
  '/admin.html',
  '/admin.js',
  '/admin-manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // On ne touche jamais aux appels vers Supabase (données toujours en direct)
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/index.html');
        });
      })
  );
});
