import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/browser-cache.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cacheBootstrap = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

async function withWindow(windowMock, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  try { return await run(); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
}

test('cache registration waits until idle, honors a relative deployment base, and seeds loaded same-origin URLs', async () => {
  const idleCallbacks = [];
  const registrations = [];
  const messages = [];
  const registration = { active: { postMessage: message => messages.push(message) } };
  const serviceWorker = {
    register: (url, options) => { registrations.push({ url, options }); return Promise.resolve(registration); },
    ready: Promise.resolve(registration),
  };
  const win = {
    isSecureContext: true,
    location: { href: 'https://app.example/project/index.html', hostname: 'app.example' },
    navigator: { serviceWorker },
    document: {
      readyState: 'complete',
      querySelectorAll: () => [
        { src: 'https://app.example/project/assets/app-12345678.js' },
        { href: 'https://app.example/project/assets/site-12345678.css' },
        { href: 'https://app.example/project/fonts/publication.css' },
        { src: 'https://cdn.example/ignored.js' },
      ],
    },
    performance: { getEntriesByType: () => [
      { name: 'https://app.example/project/data/catalog.json' },
      { name: 'https://app.example/project/assets/app-12345678.js' },
      { name: 'https://app.example/project/sources/full.pdf' },
      { name: 'https://app.example/project/fonts/publication-tw-abcdef123456.woff2' },
    ] },
    requestIdleCallback: (callback, options) => { idleCallbacks.push({ callback, options }); return 1; },
    setTimeout,
    addEventListener() {},
  };

  await withWindow(win, async () => {
    assert.equal(cacheBootstrap.initializeBrowserCacheAtBase('./'), undefined);
    assert.equal(registrations.length, 0);
    assert.equal(idleCallbacks.length, 1);
    assert.deepEqual(idleCallbacks[0].options, { timeout: 2000 });
    idleCallbacks[0].callback();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(registrations, [{
      url: 'https://app.example/project/sw.js',
      options: { scope: '/project/', updateViaCache: 'none' },
    }]);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'seed-cache-resources');
    assert.ok(messages[0].urls.includes('https://app.example/project/data/catalog.json'));
    assert.ok(messages[0].urls.includes('https://app.example/project/fonts/publication.css'));
    assert.ok(messages[0].urls.includes('https://app.example/project/fonts/publication-tw-abcdef123456.woff2'));
    assert.ok(!messages[0].urls.includes('https://app.example/project/sources/full.pdf'));
    assert.equal(new Set(messages[0].urls).size, messages[0].urls.length);
  });
});

test('insecure non-local contexts and missing service worker support skip silently', async () => {
  let registered = false;
  await withWindow({
    isSecureContext: false,
    location: { href: 'http://app.example/index.html', hostname: 'app.example' },
    navigator: { serviceWorker: { register: () => { registered = true; } } },
    document: { readyState: 'complete' },
    performance: { getEntriesByType: () => [] },
    setTimeout,
    addEventListener() {},
  }, async () => {
    assert.equal(cacheBootstrap.initializeBrowserCacheAtBase('/'), undefined);
  });
  assert.equal(registered, false);

  await withWindow({
    isSecureContext: true,
    location: { href: 'https://app.example/index.html', hostname: 'app.example' },
    navigator: {},
    document: { readyState: 'complete' },
    performance: { getEntriesByType: () => [] },
    setTimeout,
    addEventListener() {},
  }, async () => {
    assert.equal(cacheBootstrap.initializeBrowserCacheAtBase('/'), undefined);
  });
});

test('seed priority keeps the current page, catalog, edition, and fonts before excess images', async () => {
  const idleCallbacks = [];
  const messages = [];
  const registration = { active: { postMessage: message => messages.push(message) } };
  const serviceWorker = { register: async () => registration, ready: Promise.resolve(registration) };
  const win = {
    isSecureContext: true,
    location: { href: 'https://app.example/project/', hostname: 'app.example' },
    navigator: { serviceWorker },
    document: { readyState: 'complete', querySelectorAll: () => [] },
    performance: { getEntriesByType: () => [
      ...Array.from({ length: 100 }, (_, i) => ({ name: `https://app.example/project/assets/image-${i}.webp` })),
      { name: 'https://app.example/project/data/catalog.json' },
      { name: 'https://app.example/project/data/2026.json' },
      { name: 'https://app.example/project/fonts/publication.css' },
      { name: 'https://app.example/project/fonts/publication-tw-hash1234.woff2' },
    ] },
    requestIdleCallback: callback => { idleCallbacks.push(callback); return 1; },
    setTimeout,
    addEventListener() {},
  };
  await withWindow(win, async () => {
    cacheBootstrap.initializeBrowserCacheAtBase('./');
    idleCallbacks[0]();
    await new Promise(resolve => setImmediate(resolve));
    const urls = messages[0].urls;
    assert.ok(urls.length <= 80);
    assert.ok(urls.includes('https://app.example/project/'));
    assert.ok(urls.includes('https://app.example/project/data/catalog.json'));
    assert.ok(urls.includes('https://app.example/project/data/2026.json'));
    assert.ok(urls.includes('https://app.example/project/fonts/publication.css'));
    assert.ok(urls.includes('https://app.example/project/fonts/publication-tw-hash1234.woff2'));
  });
});

const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const handlers = new Map();

class FakeCache {
  entries = new Map();
  failPut = false;

  async keys() { return [...this.entries.keys()].map(url => ({ url })); }
  async match(request) { return this.entries.get(request.url)?.response ?? undefined; }
  async delete(request) { return this.entries.delete(typeof request === 'string' ? request : request.url); }
  async put(request, response) {
    if (this.failPut) throw new Error('quota exceeded');
    this.entries.set(request.url, { request, response });
  }
}

const cacheBuckets = new Map();
const cacheStorage = {
  failOpen: false,
  async open(name) {
    if (this.failOpen) throw new Error('CacheStorage unavailable');
    if (!cacheBuckets.has(name)) cacheBuckets.set(name, new FakeCache());
    return cacheBuckets.get(name);
  },
  async keys() { return [...cacheBuckets.keys()]; },
  async match(request) { for (const cache of cacheBuckets.values()) { const response = await cache.match(request); if (response) return response; } return undefined; },
  async delete(name) { return cacheBuckets.delete(name); },
};
globalThis.self = {
  location: new URL('https://app.example/project/sw.js'),
  registration: { scope: 'https://app.example/project/' },
  addEventListener: (type, listener) => handlers.set(type, listener),
  skipWaiting: async () => {},
  clients: { claim: async () => {} },
};
globalThis.caches = cacheStorage;
await import(`data:text/javascript;base64,${Buffer.from(swSource).toString('base64')}`);

function response(status, body, type = 'basic') {
  return {
    status,
    ok: status >= 200 && status < 300,
    type,
    body,
    clone() { return response(status, body, type); },
    async json() { return JSON.parse(body); },
  };
}

function request(url, overrides = {}) {
  return { url, method: 'GET', mode: 'cors', destination: '', ...overrides };
}

async function dispatchFetch(url, overrides = {}) {
  const event = {
    request: request(url, overrides),
    promises: [],
    waitUntil(promise) { this.promises.push(Promise.resolve(promise)); },
    respondWith(promise) { this.responsePromise = Promise.resolve(promise); },
  };
  handlers.get('fetch')(event);
  const result = event.responsePromise ? await event.responsePromise : undefined;
  await Promise.all(event.promises);
  return { result, intercepted: Boolean(event.responsePromise), event };
}

function ownCache() {
  const name = cacheBuckets.keys().next().value;
  return cacheBuckets.get(name);
}

test('only successful basic GET assets are cached; POST and cross-origin traffic pass through', async () => {
  cacheBuckets.clear();
  globalThis.fetch = async () => response(200, 'bundle');
  const js = await dispatchFetch('https://app.example/project/assets/app-abcdef012345.js');
  assert.equal(js.result.status, 200);
  assert.equal(ownCache().entries.size, 1);

  const beforePost = ownCache().entries.size;
  const post = await dispatchFetch('https://app.example/project/data/notes.json', { method: 'POST' });
  assert.equal(post.intercepted, false);
  assert.equal(ownCache().entries.size, beforePost);
  const privateNotes = await dispatchFetch('https://app.example/project/private/notes.json');
  assert.equal(privateNotes.intercepted, false);
  const crossOrigin = await dispatchFetch('https://cdn.example/project/assets/app-abcdef012345.js');
  assert.equal(crossOrigin.intercepted, false);
  assert.equal(ownCache().entries.size, beforePost);
});

test('partial responses and failed responses never enter CacheStorage', async () => {
  cacheBuckets.clear();
  globalThis.fetch = async request => {
    if (request.url.includes('partial')) return response(206, 'partial');
    if (request.url.includes('opaque')) return response(200, 'opaque', 'opaque');
    return response(503, 'offline');
  };
  const partial = await dispatchFetch('https://app.example/project/assets/partial-abcdef012345.js');
  const opaque = await dispatchFetch('https://app.example/project/assets/opaque-abcdef012345.js');
  const failed = await dispatchFetch('https://app.example/project/assets/fail-abcdef012345.js');
  assert.equal(partial.result.status, 206);
  assert.equal(opaque.result.type, 'opaque');
  assert.equal(failed.result.status, 503);
  assert.equal(ownCache().entries.size, 0);
});

test('stale data serves the saved response offline while a background update refreshes later visits', async () => {
  cacheBuckets.clear();
  let online = true;
  let body = 'cached catalog';
  globalThis.fetch = async () => {
    if (!online) throw new Error('offline');
    return response(200, body);
  };
  const url = 'https://app.example/project/data/catalog.json';
  const first = await dispatchFetch(url);
  assert.equal(first.result.body, 'cached catalog');

  online = false;
  const offline = await dispatchFetch(url);
  assert.equal(offline.result.body, 'cached catalog');

  online = true;
  body = 'updated catalog';
  const stale = await dispatchFetch(url);
  assert.equal(stale.result.body, 'cached catalog');
  const refreshed = await dispatchFetch(url);
  assert.equal(refreshed.result.body, 'updated catalog');
});

test('cache-first hashed assets do not refetch on repeat visits, and quota errors preserve responses', async () => {
  cacheBuckets.clear();
  let calls = 0;
  globalThis.fetch = async () => response(200, `bundle ${++calls}`);
  const url = 'https://app.example/project/assets/app-fedcba987654.js';
  assert.equal((await dispatchFetch(url)).result.body, 'bundle 1');
  assert.equal((await dispatchFetch(url)).result.body, 'bundle 1');
  assert.equal(calls, 1);

  cacheBuckets.clear();
  let freshCache;
  globalThis.fetch = async () => response(200, 'network survives quota');
  const cachePromise = cacheStorage.open('decision-islands-shell:%2Fproject%2F:v2');
  freshCache = await cachePromise;
  freshCache.failPut = true;
  const quotaResult = await dispatchFetch('https://app.example/project/data/catalog.json');
  assert.equal(quotaResult.result.body, 'network survives quota');

  cacheBuckets.clear();
  cacheStorage.failOpen = true;
  const storageUnavailable = await dispatchFetch('https://app.example/project/data/catalog.json');
  assert.equal(storageUnavailable.result.body, 'network survives quota');
  cacheStorage.failOpen = false;
});

test('Vite hashed filenames and only public v/lang query parameters use canonical cache keys', async () => {
  cacheBuckets.clear();
  let calls = 0;
  globalThis.fetch = async request => {
    calls++;
    return response(200, `${request.url} fetched`);
  };
  const versioned = await dispatchFetch('https://app.example/project/assets/index-12ziCRw7.js?v=e807');
  assert.equal(versioned.result.status, 200);
  assert.equal(ownCache().entries.size, 1);
  assert.ok(ownCache().entries.has('https://app.example/project/assets/index-12ziCRw7.js'));
  assert.equal((await dispatchFetch('https://app.example/project/assets/index-12ziCRw7.js?v=next')).result.body, versioned.result.body);
  assert.equal(calls, 1);
  const css = await dispatchFetch('https://app.example/project/assets/world-BZW2iqGB.css');
  assert.equal(css.result.status, 200);
  assert.equal((await dispatchFetch('https://app.example/project/assets/world-BZW2iqGB.css')).result.body, css.result.body);
  assert.equal(calls, 2);

  cacheBuckets.clear();
  const english = await dispatchFetch('https://app.example/project/data/catalog.json?lang=en');
  assert.equal(english.result.status, 200);
  assert.ok(ownCache().entries.has('https://app.example/project/data/catalog.json?lang=en'));
  const token = await dispatchFetch('https://app.example/project/data/catalog.json?token=private');
  assert.equal(token.intercepted, false);
  const pdf = await dispatchFetch('https://app.example/project/sources/full.pdf', { mode: 'navigate', destination: 'document' });
  assert.equal(pdf.intercepted, false);
});

test('root redirect navigation ignores campaign queries in its cache key while private data query remains network-only', async () => {
  cacheBuckets.clear();
  globalThis.fetch = async () => response(200, 'redirect entry');
  const first = await dispatchFetch('https://app.example/project/?campaign=online', { mode: 'navigate', destination: 'document' });
  assert.equal(first.result.body, 'redirect entry');
  assert.ok(ownCache().entries.has('https://app.example/project/'));

  globalThis.fetch = async () => { throw new Error('offline'); };
  const offline = await dispatchFetch('https://app.example/project/?campaign=offline', { mode: 'navigate', destination: 'document' });
  assert.equal(offline.result.body, 'redirect entry');
  const privateNavigation = await dispatchFetch('https://app.example/project/?token=private', { mode: 'navigate', destination: 'document' });
  assert.equal(privateNavigation.intercepted, false, 'private root navigation queries are never cached');
  const assetCampaign = await dispatchFetch('https://app.example/project/immersive/app.js?campaign=online');
  assert.equal(assetCampaign.intercepted, false, 'campaign parameters are allowed only on shell navigation, not other assets');
  const privateQuery = await dispatchFetch('https://app.example/project/data/catalog.json?token=private');
  assert.equal(privateQuery.intercepted, false);
});

test('root worker serves the immersive app root and public CDN modules from the scoped offline snapshot', async () => {
  cacheBuckets.clear();
  const appCache = await cacheStorage.open('decision-immersive:%2Fproject%2Fimmersive%2F:2026-10-24.3');
  await appCache.put(request('https://app.example/project/immersive/index.html'), response(200, 'immersive shell'));
  await appCache.put(request('https://app.example/project/immersive/style.css'), response(200, 'immersive css'));
  await appCache.put(request('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'), response(200, 'three module', 'cors'));
  globalThis.fetch = async () => { throw new Error('offline'); };
  const nav = await dispatchFetch('https://app.example/project/immersive/?campaign=offline', { mode: 'navigate', destination: 'document' });
  assert.equal(nav.result.body, 'immersive shell');
  const css = await dispatchFetch('https://app.example/project/immersive/style.css');
  assert.equal(css.result.body, 'immersive css');
  const three = await dispatchFetch('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', { mode: 'cors' });
  assert.equal(three.result.body, 'three module');
  const privateNav = await dispatchFetch('https://app.example/project/immersive/?token=private', { mode: 'navigate', destination: 'document' });
  assert.equal(privateNav.intercepted, false);
});

test('resource seeding is bounded to 80 URLs and app-scoped cache cleanup leaves other caches intact', async () => {
  cacheBuckets.clear();
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; return response(200, 'font'); };
  const messageEvent = {
    data: { type: 'seed-cache-resources', urls: Array.from({ length: 81 }, (_, i) => `https://app.example/project/fonts/${i}.woff2`) },
    waitUntil(promise) { this.promise = Promise.resolve(promise); },
  };
  handlers.get('message')(messageEvent);
  await messageEvent.promise;
  assert.equal(fetched, 80);
  assert.equal(ownCache().entries.size, 80);

  const ownPrefix = 'decision-islands-shell:%2Fproject%2F:';
  cacheBuckets.set(`${ownPrefix}old`, new FakeCache());
  cacheBuckets.set('other-app-cache', new FakeCache());
  const activateEvent = { waitUntil(promise) { this.promise = Promise.resolve(promise); } };
  handlers.get('activate')(activateEvent);
  await activateEvent.promise;
  assert.equal(cacheBuckets.has(`${ownPrefix}old`), false);
  assert.equal(cacheBuckets.has('other-app-cache'), true);
});

test('100 concurrent cache writes stay bounded and retain the app shell, catalog, and current edition', async () => {
  cacheBuckets.clear();
  globalThis.fetch = async request => {
    if (request.url.endsWith('/data/catalog.json')) {
      return response(200, JSON.stringify({ years: [{ year: 2026, dataUrl: 'data/2026.json' }] }));
    }
    return response(200, request.url);
  };

  await dispatchFetch('https://app.example/project/', { mode: 'navigate', destination: 'document' });
  await dispatchFetch('https://app.example/project/data/catalog.json');
  await dispatchFetch('https://app.example/project/data/2026.json');

  const assetUrls = Array.from({ length: 100 }, (_, i) =>
    `https://app.example/project/assets/world-${String(i).padStart(8, '0')}.js`);
  const results = await Promise.all(assetUrls.map(url => dispatchFetch(url)));
  assert.ok(results.every(result => result.result.status === 200));

  const cache = ownCache();
  assert.equal(cache.entries.size, 80);
  assert.ok(cache.entries.has('https://app.example/project/'));
  assert.ok(cache.entries.has('https://app.example/project/data/catalog.json'));
  assert.ok(cache.entries.has('https://app.example/project/data/2026.json'));
  assert.ok(!cache.entries.has(assetUrls[0]), 'old hashed assets should be evicted before current page data');
  assert.ok(cache.entries.has(assetUrls.at(-1)));

  cache.failPut = true;
  const quotaResult = await dispatchFetch('https://app.example/project/assets/quota-00000001.js');
  assert.equal(quotaResult.result.status, 200, 'quota failures must not change the network response');
  cache.failPut = false;
  const afterQuota = await dispatchFetch('https://app.example/project/assets/recovered-00000001.js');
  assert.equal(afterQuota.result.status, 200);
  assert.ok(cache.entries.size <= 80, 'the mutation queue must recover after a failed put');
  assert.ok(cache.entries.has('https://app.example/project/'));
  assert.ok(cache.entries.has('https://app.example/project/data/catalog.json'));
  assert.ok(cache.entries.has('https://app.example/project/data/2026.json'));
});

test('active entry JS, CSS, and hashed fonts survive 100 historical HTML pages and remain usable offline', async () => {
  cacheBuckets.clear();
  const oldFont = 'https://app.example/project/fonts/publication-tw-oldhash123456.woff2';
  const current = [
    'https://app.example/project/',
    'https://app.example/project/data/catalog.json',
    'https://app.example/project/data/2026.json',
    'https://app.example/project/assets/index-12ziCRw7.js',
    'https://app.example/project/assets/index-D4pOqfUM.css',
    'https://app.example/project/fonts/publication.css',
    'https://app.example/project/fonts/publication-tw-newhash123456.woff2',
  ];
  globalThis.fetch = async request => {
    if (request.url.endsWith('/data/catalog.json')) {
      return response(200, JSON.stringify({ years: [{ year: 2026, dataUrl: 'data/2026.json' }] }));
    }
    return response(200, request.url);
  };
  const seed = async urls => {
    const event = {
      data: { type: 'seed-cache-resources', urls },
      waitUntil(promise) { this.promise = Promise.resolve(promise); },
    };
    handlers.get('message')(event);
    await event.promise;
  };

  await seed([oldFont]);
  await seed(current);
  const historicalPages = Array.from({ length: 100 }, (_, i) =>
    `https://app.example/project/read/2025/article-${String(i).padStart(3, '0')}.html`);
  await Promise.all(historicalPages.map(url => dispatchFetch(url, { mode: 'navigate', destination: 'document' })));

  const cache = ownCache();
  assert.equal(cache.entries.size, 80);
  assert.ok(current.every(url => cache.entries.has(url)), 'current app shell dependencies should remain cached');
  assert.ok(!cache.entries.has(oldFont), 'superseded content-hashed fonts should be evicted first');

  globalThis.fetch = async () => { throw new Error('offline'); };
  for (const url of current) {
    const overrides = url.endsWith('/') ? { mode: 'navigate', destination: 'document' } : {};
    assert.equal((await dispatchFetch(url, overrides)).result.status, 200, `offline cache should serve ${url}`);
  }
});

test('static reading HTML and publication font CSS are stale-while-revalidate offline fallbacks', async () => {
  cacheBuckets.clear();
  let online = true;
  globalThis.fetch = async () => {
    if (!online) throw new Error('offline');
    return response(200, 'cached public file');
  };
  const article = 'https://app.example/project/read/2026/2026-01.html';
  assert.equal((await dispatchFetch(article, { mode: 'navigate', destination: 'document' })).result.body, 'cached public file');
  const fontsCss = 'https://app.example/project/fonts/publication.css';
  assert.equal((await dispatchFetch(fontsCss)).result.body, 'cached public file');

  online = false;
  assert.equal((await dispatchFetch(article, { mode: 'navigate', destination: 'document' })).result.body, 'cached public file');
  assert.equal((await dispatchFetch(fontsCss)).result.body, 'cached public file');
});
