const CACHE_VERSION = 'v1';
const MAX_CACHE_ENTRIES = 80;
const scopePath = new URL(self.registration.scope).pathname;
const scopeKey = encodeURIComponent(scopePath);
const CACHE_PREFIX = `decision-islands-shell:${scopeKey}:`;
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const activeHashedAssets = new Set();
let currentEditionUrl = null;
let cacheMutationQueue = Promise.resolve();

function cachePolicy(request) {
  if (!request || request.method !== 'GET') return 'network';
  let url;
  try { url = new URL(request.url); } catch { return 'network'; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath) || /\.pdf$/i.test(url.pathname)) return 'network';
  if (/(?:^|\/)(?:api|auth|private|notes?|session|token)(?:\/|$)/i.test(url.pathname)) return 'network';
  const isScopeRoot = url.pathname === scopePath || url.pathname === `${scopePath}index.html`;
  const isRootRedirectNavigation = request.mode === 'navigate' && url.pathname === scopePath;
  if (!isRootRedirectNavigation) {
    for (const [name, value] of url.searchParams) {
      if (name === 'v' && /^[A-Za-z0-9._-]{1,64}$/.test(value)) continue;
      if (name === 'lang' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)) continue;
      return 'network';
    }
  }
  const isHtmlNavigation = request.mode === 'navigate' && /\.html?$/i.test(url.pathname);
  if (request.mode === 'navigate' && !isScopeRoot && !isHtmlNavigation) return 'network';
  const isShellNavigation = isScopeRoot || isHtmlNavigation;
  if (isShellNavigation) return 'stale';
  if (/\/data\/[^/]+\.json$/i.test(url.pathname)) return 'stale';
  if (/\/fonts\/[^/]+\.css$/i.test(url.pathname)) return 'stale';
  if (/(?:-|\.)[A-Za-z0-9_-]{8,}\.(?:js|css)$/i.test(url.pathname)) return 'cache-first';
  if (/\.(?:woff2?|ttf|otf|png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname)) return 'cache-first';
  return 'network';
}

function canonicalCacheRequest(request) {
  let url;
  try { url = new URL(request.url); } catch { return null; }
  if (request.mode === 'navigate' && url.pathname === scopePath) {
    // The main entry only redirects; campaign parameters do not change its body.
    // Drop them from the cache key while the redirect script preserves them.
    url.search = '';
  } else {
    const versionValues = url.searchParams.getAll('v');
    const languageValues = url.searchParams.getAll('lang');
    if (versionValues.length > 1 || languageValues.length > 1) return null;
    url.searchParams.delete('v');
  }
  return new Request(url.href, { method: 'GET', credentials: 'same-origin' });
}

function canonicalUrl(value) {
  const request = typeof value === 'string' ? { url: value } : value;
  return canonicalCacheRequest(request)?.url ?? null;
}

function isContentHashedAsset(pathname) {
  return /(?:-|\.)[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/i.test(pathname);
}

function rememberActiveAssets(urls, replace = false) {
  if (replace) activeHashedAssets.clear();
  for (const value of urls) {
    try {
      const request = new Request(value, { method: 'GET', credentials: 'same-origin' });
      const url = new URL(request.url);
      if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath) || !isContentHashedAsset(url.pathname)) continue;
      if (cachePolicy(request) !== 'cache-first') continue;
      const key = canonicalUrl(request);
      if (!key) continue;
      activeHashedAssets.delete(key);
      activeHashedAssets.add(key);
      while (activeHashedAssets.size > MAX_CACHE_ENTRIES) activeHashedAssets.delete(activeHashedAssets.values().next().value);
    } catch { /* Ignore invalid page resource URLs. */ }
  }
}

async function rememberCurrentEdition(response, request) {
  let catalogUrl;
  try { catalogUrl = new URL(request.url); } catch { return; }
  if (!/\/data\/catalog\.json$/i.test(catalogUrl.pathname)) return;
  try {
    const catalog = await response.clone().json();
    if (!catalog || !Array.isArray(catalog.years)) return;
    const latest = catalog.years
      .filter(entry => entry && Number.isFinite(Number(entry.year)) && typeof entry.dataUrl === 'string')
      .sort((left, right) => Number(right.year) - Number(left.year))[0];
    if (!latest) return;
    const appRoot = new URL('../', catalogUrl);
    const editionUrl = new URL(latest.dataUrl, appRoot);
    if (editionUrl.origin !== self.location.origin || !editionUrl.pathname.startsWith(scopePath) || !/\/data\/\d{4}\.json$/i.test(editionUrl.pathname)) return;
    currentEditionUrl = canonicalUrl(editionUrl.href);
  } catch { /* Catalog changes must never interfere with its network response. */ }
}

function evictionPriority(request) {
  let url;
  try { url = new URL(request.url); } catch { return 100; }
  const languageVariant = url.searchParams.has('lang');
  if (url.pathname === scopePath || url.pathname === `${scopePath}index.html`) return languageVariant ? 1 : 0;
  if (/\/data\/catalog\.json$/i.test(url.pathname)) return languageVariant ? 3 : 2;
  const canonical = canonicalUrl(request);
  if (canonical && canonical === currentEditionUrl) return languageVariant ? 5 : 4;
  if (currentEditionUrl && new URL(currentEditionUrl).pathname === url.pathname) return 5;
  if (isContentHashedAsset(url.pathname)) return canonical && activeHashedAssets.has(canonical) ? 5 : 30;
  if (/\/fonts\/[^/]+\.css$/i.test(url.pathname)) return 6;
  if (/\/data\/\d{4}\.json$/i.test(url.pathname)) return 7;
  if (/\.html?$/i.test(url.pathname)) return 8;
  if (/\.(?:woff2?|ttf|otf)$/i.test(url.pathname)) return 9;
  if (/\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname)) return 12;
  return 20;
}

function chooseEvictionKey(keys, incomingUrl, force = false) {
  const incomingPriority = evictionPriority({ url: incomingUrl });
  const candidates = keys
    .map((key, index) => ({ key, index, priority: evictionPriority(key) }))
    .filter(candidate => candidate.key.url !== incomingUrl)
    .sort((left, right) => right.priority - left.priority || left.index - right.index);
  const candidate = candidates[0];
  if (!candidate || (!force && candidate.priority < incomingPriority)) return null;
  return candidate.key;
}

function serializeCacheMutation(operation) {
  const result = cacheMutationQueue.then(operation, operation);
  cacheMutationQueue = result.catch(() => undefined);
  return result;
}

function cacheableResponse(response) {
  return Boolean(response && response.ok && response.status === 200 && response.type === 'basic');
}

async function putBounded(cache, request, response) {
  try {
    await serializeCacheMutation(async () => {
      let keys = await cache.keys();
      let existing = keys.some(key => key.url === request.url);
      while (keys.length > MAX_CACHE_ENTRIES || (!existing && keys.length >= MAX_CACHE_ENTRIES)) {
        const forceTrim = keys.length > MAX_CACHE_ENTRIES;
        const victim = chooseEvictionKey(keys, request.url, forceTrim);
        if (!victim) return;
        const before = keys.length;
        await cache.delete(victim);
        keys = await cache.keys();
        if (keys.length >= before) return;
        existing = keys.some(key => key.url === request.url);
      }
      if (!existing && keys.length >= MAX_CACHE_ENTRIES) return;
      await cache.put(request, response.clone());

      keys = await cache.keys();
      while (keys.length > MAX_CACHE_ENTRIES) {
        const victim = chooseEvictionKey(keys, request.url, true);
        if (!victim) return;
        const before = keys.length;
        await cache.delete(victim);
        keys = await cache.keys();
        if (keys.length >= before) return;
      }
    });
  } catch { /* Quota errors must not break the network response. */ }
}

async function fetchAndCache(cache, request, cacheKey = request) {
  const response = await fetch(request);
  if (cacheableResponse(response)) {
    await rememberCurrentEdition(response, request);
    await putBounded(cache, cacheKey, response);
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const policy = cachePolicy(event.request);
  if (policy === 'network') return;
  const cacheKey = canonicalCacheRequest(event.request);
  if (!cacheKey) return;
  if (policy === 'cache-first' && isContentHashedAsset(new URL(event.request.url).pathname)) {
    rememberActiveAssets([event.request.url]);
  }

  const cachePromise = caches.open(CACHE_NAME).catch(() => null);
  const cachedPromise = cachePromise
    .then(cache => cache ? cache.match(cacheKey).catch(() => undefined) : undefined)
    .catch(() => undefined);
  if (policy === 'cache-first') {
    const updatePromise = cachedPromise.then(cached => cached ? null : cachePromise.then(cache => cache
      ? fetchAndCache(cache, event.request, cacheKey)
      : fetch(event.request)));
    event.waitUntil(updatePromise.catch(() => undefined));
    event.respondWith(cachedPromise.then(cached => cached || updatePromise).then(response => response || fetch(event.request)));
    return;
  }

  const updatePromise = cachePromise.then(cache => cache
    ? fetchAndCache(cache, event.request, cacheKey)
    : fetch(event.request));
  event.waitUntil(updatePromise.catch(() => undefined));
  event.respondWith(cachedPromise.then(cached => cached || updatePromise));
});

async function seedResources(urls) {
  const cache = await caches.open(CACHE_NAME);
  const seen = new Set();
  for (const value of urls.slice(0, MAX_CACHE_ENTRIES)) {
    let url;
    try { url = new URL(value, self.registration.scope); } catch { continue; }
    if (url.origin !== self.location.origin || seen.has(url.href)) continue;
    seen.add(url.href);
    const request = new Request(url.href, { method: 'GET', cache: 'force-cache', credentials: 'same-origin' });
    if (cachePolicy(request) === 'network') continue;
    const cacheKey = canonicalCacheRequest(request);
    if (!cacheKey) continue;
    try {
      const response = await fetch(request);
      if (cacheableResponse(response)) {
        await rememberCurrentEdition(response, request);
        await putBounded(cache, cacheKey, response);
      }
    } catch { /* A resource missing from the HTTP cache is simply left for a later visit. */ }
  }
}

self.addEventListener('message', event => {
  const message = event.data;
  if (!message || message.type !== 'seed-cache-resources' || !Array.isArray(message.urls)) return;
  rememberActiveAssets(message.urls.filter(value => typeof value === 'string'), true);
  event.waitUntil(seedResources(message.urls.filter(value => typeof value === 'string')).catch(() => undefined));
});
