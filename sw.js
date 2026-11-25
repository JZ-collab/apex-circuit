/* APEX CIRCUIT offline app shell. Network-first, cache fallback. */
const CACHE = 'apex-circuit-v2';
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/main.js', './js/ui.js', './js/config.js', './js/storage.js',
  './js/assets.js', './js/car.js', './js/track.js', './js/physics.js',
  './js/ai.js', './js/audio.js', './js/effects.js',
  './vendor/three.module.js', './vendor/GLTFLoader.js',
  './vendor/utils/BufferGeometryUtils.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
