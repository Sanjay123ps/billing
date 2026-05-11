// ============================================================
//  Ayini Billing PWA — Service Worker
//  Strategy:
//    • Static shell  → Cache First (instant loads)
//    • API calls     → Network Only  (always fresh data)
//    • Everything else → Network First with cache fallback
// ============================================================

const CACHE_VERSION  = 'v1';
const STATIC_CACHE   = `ayini-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE  = `ayini-dynamic-${CACHE_VERSION}`;
const ALL_CACHES     = [STATIC_CACHE, DYNAMIC_CACHE];

// Files that form the app shell — cache on install
const STATIC_SHELL = [
  '/mobile-pos.html',
  '/style.css',
  '/api.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Routes that must NEVER be served from cache
const NETWORK_ONLY_PATTERNS = [
  /\/api\//,       // all backend API routes
  /\/auth\//,      // login / JWT endpoints
  /\/bills/,       // billing data
  /\/products/,    // product/stock data
  /\/reports/,     // reports & summaries
];

// ──────────────────────────────────────────────
//  INSTALL — pre-cache the app shell
// ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

// ──────────────────────────────────────────────
//  ACTIVATE — delete stale caches
// ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => !ALL_CACHES.includes(k))
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ──────────────────────────────────────────────
//  FETCH — routing logic
// ──────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // 1. Network-only for API / data routes
  if (NETWORK_ONLY_PATTERNS.some(re => re.test(url.pathname))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Cache-first for static shell files
  if (STATIC_SHELL.some(path => url.pathname.endsWith(path.replace(/^\//, '')))) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetchAndCache(request, STATIC_CACHE))
    );
    return;
  }

  // 3. Network-first with dynamic cache fallback for everything else
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ──────────────────────────────────────────────
//  HELPER — fetch, cache, and return response
// ──────────────────────────────────────────────
async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}
