const CACHE_VERSION = 'v2';
const APP_SHELL_CACHE = `qorix-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `qorix-runtime-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: pre-cache the app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)),
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin, non-GET, and browser-extension requests
  if (
    url.origin !== self.location.origin ||
    request.method !== 'GET' ||
    url.pathname.startsWith('/__')
  ) {
    return;
  }

  // API calls → network-first (no cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // App shell & static assets → cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }

  // HTML navigation → stale-while-revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else → network-first with runtime cache fallback
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

// ── Strategies ────────────────────────────────────────────────────────────────
function isStaticAsset(pathname) {
  return (
    APP_SHELL_URLS.includes(pathname) ||
    /\.(js|css|png|svg|jpg|jpeg|webp|woff2?|ico)$/.test(pathname)
  );
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? (await fetchPromise) ?? new Response('Offline', { status: 503 });
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'No internet connection' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
