const CACHE_NAME = 'kryno-ia-v6';
const ASSETS = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Nunca interceptar rotas de autenticação (OAuth redirects não podem ser cacheados)
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return;

  // Navegações (mudança de página inteira) sempre vão direto pra rede,
  // evita erro de navegação quebrar o app dentro da TWA
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(resp => {
        // Nunca cachear respostas de redirect ou não-ok (Cache API não permite redirect)
        if (!resp || resp.redirected || !resp.ok || resp.type === 'opaqueredirect') {
          return resp;
        }
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached);
    })
  );
});
