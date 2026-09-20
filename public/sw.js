/*
 * KAVOVO service worker.
 *
 * The point is a kitchen with bad signal: a recipe you have already opened
 * should still open, and brew mode should still run. Nothing here is allowed to
 * serve stale HTML — pages are always tried on the network first, and the cache
 * is only what answers when the network does not.
 *
 * Bump VERSION to retire every cache from the previous release.
 */
const VERSION = 'v1';
const SHELL = `kavovo-shell-${VERSION}`;
const RUNTIME = `kavovo-runtime-${VERSION}`;
const OFFLINE_URL = '/offline/';

/** Content-hashed, so a hit is always the right file and can be kept forever. */
const IMMUTABLE = /^\/(?:_astro|img)\//;
/** Plain names that change rarely: worth caching, never worth trusting blindly. */
const REVALIDATE = /^\/(?:images|icons)\/|^\/(?:favicon|apple-touch-icon)\.png$|\.json$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL && key !== RUNTIME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await network) ?? Response.error();
}

/**
 * A page is the same page whatever tracking parameters brought you to it.
 * Keying navigations on the full URL would cache /recipes/v60-pour-over/ once
 * per ?utm_source= and then miss every one of them on the clean URL, which is
 * exactly what an offline visit asks for.
 */
function navigationKey(url) {
  return `${url.origin}${url.pathname}`;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const key = isNavigation ? navigationKey(url) : request;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(key, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(key);
    if (cached) return cached;
    if (isNavigation) {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Subscriptions must always reach the Worker, and a cached answer to one
  // would be meaningless anyway.
  if (url.pathname.startsWith('/api/')) return;

  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (REVALIDATE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
