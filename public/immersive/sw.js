// Bump this value when any core asset changes so each release keeps one complete snapshot.
const CACHE_VERSION = '2026-10-24.10';
const MAX_CACHE_ENTRIES = 60;
const OPTIONAL_CACHE_TIMEOUT_MS = 5000;
const APP_SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `decision-immersive:${encodeURIComponent(APP_SCOPE.pathname)}:`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const CORE_PATHS = [
  './index.html',
  './app.js',
  './data.js',
  './world.js',
  './editorial-textures.js',
  './character-events.js',
  './intro.js',
  './progress.js',
  './cache.js',
  './style.css',
  './contrast.css',
  '../data/2026.json',
  '../fonts/publication.css',
];

const FONT_PATHS = [
  '../fonts/publication-latin-2a33d5d6a5.woff2',
  '../fonts/publication-tc-supplement-0537efd18e.woff2',
  '../fonts/publication-tw-variable-0-a744bc8b6c.woff2',
  '../fonts/publication-tw-variable-1-6cb5b4634b.woff2',
  '../fonts/publication-tw-variable-2-773e05b1bc.woff2',
  '../fonts/publication-tw-variable-3-81c18e680d.woff2',
  '../fonts/publication-tw-variable-4-57e2764204.woff2',
  '../fonts/publication-tw-variable-5-5d4b6c9d18.woff2',
  '../fonts/publication-tw-variable-6-4358d63bf0.woff2',
  '../fonts/publication-tw-variable-7-0b34eb3fe3.woff2',
  '../fonts/publication-tw-variable-8-7a1dc60589.woff2',
];

const OPTIONAL_LOCAL_PATHS = [
  '../assets/cover-2026.webp',
  ...FONT_PATHS,
];

const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js',
].map(value => new URL(value));

const CORE_URLS = CORE_PATHS.map(path => new URL(path, APP_SCOPE));
const OPTIONAL_LOCAL_URLS = OPTIONAL_LOCAL_PATHS.map(path => new URL(path, APP_SCOPE));
const LOCAL_URLS = new Set([...CORE_URLS, ...OPTIONAL_LOCAL_URLS].map(url => url.href));
const CDN_URL_SET = new Set(CDN_URLS.map(url => url.href));
const APPROVED_URL_COUNT = LOCAL_URLS.size + CDN_URL_SET.size;

if (APPROVED_URL_COUNT > MAX_CACHE_ENTRIES) {
  throw new Error('The immersive offline manifest exceeds its cache limit.');
}

function validResponse(response, url) {
  if (!response || response.status !== 200 || !response.ok || response.url !== url.href) return false;
  return url.origin === APP_SCOPE.origin ? response.type === 'basic' : response.type === 'cors';
}

function networkRequest(url, signal) {
  return new Request(url.href, {
    method: 'GET',
    mode: url.origin === APP_SCOPE.origin ? 'same-origin' : 'cors',
    credentials: 'omit',
    cache: 'reload',
    redirect: 'error',
    ...(signal ? { signal } : {}),
  });
}

async function fetchAndStore(cache, url, signal) {
  const response = await fetch(networkRequest(url, signal));
  if (!validResponse(response, url)) return false;

  const cached = await cache.match(url.href);
  if (!cached && (await cache.keys()).length >= MAX_CACHE_ENTRIES) return false;
  await cache.put(url.href, response.clone());
  return true;
}

async function cacheUrls(cache, urls, { required, concurrency, signal }) {
  let nextIndex = 0;
  const failures = [];

  async function runWorker() {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      try {
        if (await cache.match(url.href)) continue;
        const cached = await fetchAndStore(cache, url, signal);
        if (!cached && required) failures.push(url.href);
      } catch {
        if (required) failures.push(url.href);
      }
    }
  }

  const workerCount = Math.min(concurrency, urls.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  if (failures.length > 0) throw new Error(`Required immersive assets could not be cached (${failures.length}).`);
}

async function hasCompleteCore(cache) {
  if ((await cache.keys()).length > MAX_CACHE_ENTRIES) return false;
  for (const url of CORE_URLS) {
    const response = await cache.match(url.href);
    if (!response || response.status !== 200 || !response.ok) return false;
  }
  return true;
}

async function installCore() {
  let cache = await caches.open(CACHE_NAME);
  if (await hasCompleteCore(cache)) return cache;

  await caches.delete(CACHE_NAME);
  cache = await caches.open(CACHE_NAME);
  try {
    await cacheUrls(cache, CORE_URLS, { required: true, concurrency: 4 });
    if (!(await hasCompleteCore(cache))) throw new Error('The immersive core cache is incomplete.');
    return cache;
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

async function installOptional(cache) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPTIONAL_CACHE_TIMEOUT_MS);
  try {
    await cacheUrls(cache, [...OPTIONAL_LOCAL_URLS, ...CDN_URLS], {
      required: false,
      concurrency: 3,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function cacheableRequest(request) {
  if (!request || request.method !== 'GET') return null;
  if (request.headers?.has('authorization') || request.headers?.has('range')) return null;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  if (url.username || url.password) return null;

  if (url.origin === APP_SCOPE.origin) {
    if (request.mode === 'navigate' && url.pathname === APP_SCOPE.pathname) {
      for (const [name, value] of url.searchParams) {
        if (name === 'campaign' && /^[A-Za-z0-9._~-]{1,80}$/.test(value)) continue;
        if (name === 'lang' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)) continue;
        if (name === 'v' && /^[A-Za-z0-9._-]{1,64}$/.test(value)) continue;
        return null;
      }
      url = new URL('./index.html', APP_SCOPE);
      return { url, key: url.href };
    }
    if (request.credentials === 'include' && !LOCAL_URLS.has(url.href)) return null;
    if (url.search) {
      const versions = url.searchParams.getAll('v');
      if ([...url.searchParams].length !== 1 || versions.length !== 1 || !/^[A-Za-z0-9._-]{1,64}$/.test(versions[0])) {
        return null;
      }
      url.search = '';
    }
    if (!LOCAL_URLS.has(url.href)) return null;
    return { url, key: url.href };
  }

  if (request.credentials === 'include' || request.mode !== 'cors' || !CDN_URL_SET.has(url.href)) return null;
  return { url, key: url.href };
}

async function serveFromCache(request, entry) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(entry.key);
    if (cached) return cached;
  } catch {
    cache = null;
  }

  const response = await fetch(networkRequest(entry.url));
  if (cache && validResponse(response, entry.url)) {
    try {
      const cached = await cache.match(entry.key);
      if (!cached && (await cache.keys()).length < MAX_CACHE_ENTRIES) {
        await cache.put(entry.key, response.clone());
      }
    } catch {
      // A storage or quota error must not replace the network response.
    }
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await installCore();
    await installOptional(cache);

    // The first scoped worker can take over a broader legacy worker. Later releases wait for old clients to close.
    if (!self.registration.active) {
      try {
        await self.skipWaiting();
      } catch {
        // A failed skipWaiting call leaves the fully installed worker waiting for activation.
      }
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name)));
    } catch {
      // Cleanup must not stop the new worker from claiming its own scope.
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const entry = cacheableRequest(event.request);
  if (!entry) return;
  event.respondWith(serveFromCache(event.request, entry));
});
