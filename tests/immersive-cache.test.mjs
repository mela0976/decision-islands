import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const originalGlobals = new Map(['window', 'self', 'caches', 'fetch'].map(name => [
  name,
  Object.getOwnPropertyDescriptor(globalThis, name),
]));
const serviceWorkerSource = readFileSync(new URL('../public/immersive/sw.js', import.meta.url), 'utf8');
const currentCacheVersion = serviceWorkerSource.match(/const CACHE_VERSION = '([^']+)'/)?.[1];
assert.ok(currentCacheVersion, 'service worker declares its cache version');

after(() => {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

const cacheModule = await import(new URL('../public/immersive/cache.js', import.meta.url));

async function withWindow(windowRef, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowRef });
  try {
    return await run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
}

test('initOfflineCache returns before idle registration and resolves worker paths from its module URL', async () => {
  const idleCallbacks = [];
  const statuses = [];
  const registrations = [];
  let resolveRegistration;
  const registrationResult = new Promise(resolve => { resolveRegistration = resolve; });
  const serviceWorker = {
    register: (url, options) => {
      registrations.push({ url, options });
      return registrationResult;
    },
  };
  const expectedWorkerUrl = new URL('../public/immersive/sw.js', import.meta.url);
  const expectedScopeUrl = new URL('../public/immersive/', import.meta.url);

  await withWindow({
    isSecureContext: true,
    location: { hostname: 'reader.example' },
    navigator: { serviceWorker },
    requestIdleCallback: (callback, options) => { idleCallbacks.push({ callback, options }); },
    setTimeout,
  }, async () => {
    assert.equal(cacheModule.initOfflineCache({ onStatus: status => statuses.push(status) }), undefined);
    assert.equal(registrations.length, 0);
    assert.equal(idleCallbacks.length, 1);
    assert.deepEqual(idleCallbacks[0].options, { timeout: 2000 });

    idleCallbacks[0].callback();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(registrations, [{
      url: expectedWorkerUrl.href,
      options: { scope: expectedScopeUrl.pathname, updateViaCache: 'none' },
    }]);
    assert.deepEqual(statuses, []);

    resolveRegistration({ scope: expectedScopeUrl.href });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(statuses, [{ state: 'registered', scope: expectedScopeUrl.href }]);
  });
});

test('insecure origins skip registration and localhost remains available', async () => {
  const states = [];
  let registered = false;
  await withWindow({
    isSecureContext: false,
    location: { hostname: 'reader.example' },
    navigator: { serviceWorker: { register: () => { registered = true; } } },
    setTimeout,
  }, async () => {
    assert.equal(cacheModule.initOfflineCache({ onStatus: status => states.push(status.state) }), undefined);
  });
  assert.equal(registered, false);
  assert.deepEqual(states, ['unavailable']);

  const idleCallbacks = [];
  await withWindow({
    isSecureContext: false,
    location: { hostname: 'localhost' },
    navigator: { serviceWorker: { register: () => { registered = true; return Promise.resolve({}); } } },
    requestIdleCallback: callback => idleCallbacks.push(callback),
    setTimeout,
  }, async () => {
    assert.equal(cacheModule.initOfflineCache(), undefined);
    idleCallbacks[0]();
    await new Promise(resolve => setImmediate(resolve));
  });
  assert.equal(registered, true);
});

test('registration errors stay silent without a listener and cannot escape a throwing listener', async () => {
  const idleCallbacks = [];
  const statuses = [];
  await withWindow({
    isSecureContext: true,
    location: { hostname: 'reader.example' },
    navigator: { serviceWorker: { register: async () => { throw new Error('registration failed'); } } },
    requestIdleCallback: callback => idleCallbacks.push(callback),
    setTimeout,
  }, async () => {
    assert.doesNotThrow(() => cacheModule.initOfflineCache());
    idleCallbacks.shift()();
    await new Promise(resolve => setImmediate(resolve));

    assert.doesNotThrow(() => cacheModule.initOfflineCache({ onStatus: status => statuses.push(status.state) }));
    idleCallbacks.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(statuses, ['failed']);

    assert.doesNotThrow(() => cacheModule.initOfflineCache({ onStatus: () => { throw new Error('listener failed'); } }));
    idleCallbacks.shift()();
    await new Promise(resolve => setImmediate(resolve));
  });
});

class FakeCache {
  entries = new Map();
  failPut = false;

  async keys() {
    return [...this.entries.keys()].map(url => new Request(url));
  }

  async match(request) {
    const url = typeof request === 'string' ? request : request.url;
    return this.entries.get(url);
  }

  async put(request, response) {
    if (this.failPut) throw new Error('quota exceeded');
    const url = typeof request === 'string' ? request : request.url;
    this.entries.set(url, response.clone());
  }

  async delete(request) {
    const url = typeof request === 'string' ? request : request.url;
    return this.entries.delete(url);
  }
}

class FakeCacheStorage {
  entries = new Map();
  failOpen = false;

  async open(name) {
    if (this.failOpen) throw new Error('CacheStorage unavailable');
    if (!this.entries.has(name)) this.entries.set(name, new FakeCache());
    return this.entries.get(name);
  }

  async keys() {
    return [...this.entries.keys()];
  }

  async delete(name) {
    return this.entries.delete(name);
  }
}

function makeResponse(url, status = 200, type = new URL(url).origin === 'https://reader.example' ? 'basic' : 'cors') {
  return {
    url,
    status,
    ok: status >= 200 && status < 300,
    type,
    body: `body:${url}`,
    clone() { return makeResponse(url, status, type); },
  };
}

const appScope = new URL('https://reader.example/project/immersive/');
const scopePrefix = `decision-immersive:${encodeURIComponent(appScope.pathname)}:`;
const cacheStorage = new FakeCacheStorage();
const listeners = new Map();
let skipWaitingCount = 0;
let claimCount = 0;
let fetchCalls = [];

globalThis.caches = cacheStorage;
globalThis.self = {
  location: new URL('sw.js', appScope),
  registration: { scope: appScope.href, active: null },
  addEventListener: (name, listener) => listeners.set(name, listener),
  skipWaiting: async () => { skipWaitingCount++; },
  clients: { claim: async () => { claimCount++; } },
};

await import(new URL(`../public/immersive/sw.js?test=${Date.now()}`, import.meta.url));

function defaultFetch(request) {
  fetchCalls.push(request);
  return Promise.resolve(makeResponse(request.url));
}

globalThis.fetch = defaultFetch;

async function dispatchLifecycle(name) {
  const promises = [];
  const event = { waitUntil: promise => promises.push(Promise.resolve(promise)) };
  listeners.get(name)(event);
  const outcomes = await Promise.allSettled(promises);
  const failure = outcomes.find(outcome => outcome.status === 'rejected');
  if (failure) throw failure.reason;
}

async function dispatchFetch(url, init = {}) {
  const promises = [];
  const { mode, ...requestInit } = init;
  const request = new Request(url, requestInit);
  if (mode) Object.defineProperty(request, 'mode', { value: mode });
  const event = {
    request,
    waitUntil: promise => promises.push(Promise.resolve(promise)),
  };
  event.respondWith = promise => { event.responsePromise = Promise.resolve(promise); };
  listeners.get('fetch')(event);
  const intercepted = Boolean(event.responsePromise);
  const response = intercepted ? await event.responsePromise : undefined;
  await Promise.allSettled(promises);
  return { intercepted, response };
}

function currentCache() {
  const name = cacheStorage.entries.keys().next().value;
  return name ? cacheStorage.entries.get(name) : null;
}

function currentCacheName() {
  return [...cacheStorage.entries.keys()].find(name => name.startsWith(scopePrefix) && name.endsWith(currentCacheVersion));
}

function coreUrls() {
  return [
    './index.html', './app.js', './data.js', './world.js', './editorial-textures.js', './character-events.js', './intro.js', './progress.js', './cache.js',
    './style.css', './contrast.css', '../data/2026.json', '../fonts/publication.css',
  ].map(path => new URL(path, appScope).href);
}

function optionalUrls() {
  const cssUrl = new URL('../fonts/publication.css', appScope);
  const css = readFileSync(new URL('../public/fonts/publication.css', import.meta.url), 'utf8');
  const fontPaths = [...css.matchAll(/url\((['"]?)([^'")]+\.woff2)\1\)/g)].map(match => match[2]);
  assert.equal(new Set(fontPaths).size, 11, 'the publication stylesheet has eleven font subsets');
  const fonts = fontPaths.map(path => new URL(path, cssUrl).href);
  return [new URL('../assets/cover-2026.webp', appScope).href, ...fonts];
}

test('installation removes a partial core cache on failure and leaves old caches for activation', async () => {
  cacheStorage.entries.clear();
  cacheStorage.entries.set(`${scopePrefix}old`, new FakeCache());
  cacheStorage.entries.set('decision-islands-shell:/project/:v1', new FakeCache());
  fetchCalls = [];
  globalThis.fetch = request => {
    fetchCalls.push(request);
    if (request.url === new URL('./app.js', appScope).href) return Promise.resolve(makeResponse(request.url, 503));
    return Promise.resolve(makeResponse(request.url));
  };

  await assert.rejects(dispatchLifecycle('install'), /Required immersive assets/);
  assert.equal(currentCacheName(), undefined);
  assert.ok(cacheStorage.entries.has(`${scopePrefix}old`));
  assert.ok(cacheStorage.entries.has('decision-islands-shell:/project/:v1'));
  assert.ok(fetchCalls.every(request => request.credentials === 'omit'));
  assert.ok(fetchCalls.every(request => request.cache === 'reload'));
});

test('a complete public snapshot caches required files, CSS fonts, cover, and only fixed CDN modules', async () => {
  cacheStorage.entries.clear();
  self.registration.active = null;
  skipWaitingCount = 0;
  claimCount = 0;
  fetchCalls = [];
  globalThis.fetch = defaultFetch;

  await dispatchLifecycle('install');
  const name = currentCacheName();
  assert.ok(name, 'the worker creates a versioned cache for this scope');
  const cache = cacheStorage.entries.get(name);
  const keys = [...cache.entries.keys()];
  const expected = [
    ...coreUrls(),
    ...optionalUrls(),
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
    'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js',
  ];
  assert.ok(expected.every(url => cache.entries.has(url)));
  assert.ok(keys.length <= 60);
  assert.ok(fetchCalls.every(request => request.credentials === 'omit'));
  assert.ok(fetchCalls.every(request => request.redirect === 'error'));
  assert.ok(fetchCalls.every(request => new URL(request.url).origin === appScope.origin || request.url.startsWith('https://cdn.jsdelivr.net/npm/three@0.160.0/')));
  assert.equal(skipWaitingCount, 1, 'the first scoped worker can claim a legacy root scope');

  cacheStorage.entries.set(`${scopePrefix}old`, new FakeCache());
  cacheStorage.entries.set('decision-islands-shell:/project/:v1', new FakeCache());
  cacheStorage.entries.set('unrelated-cache', new FakeCache());
  assert.ok(cacheStorage.entries.has(`${scopePrefix}old`), 'installation does not remove the old release');
  await dispatchLifecycle('activate');
  assert.equal(cacheStorage.entries.has(`${scopePrefix}old`), false);
  assert.equal(cacheStorage.entries.has('unrelated-cache'), true);
  assert.equal(cacheStorage.entries.has('decision-islands-shell:/project/:v1'), true);
  assert.equal(claimCount, 1);

  self.registration.active = { scriptURL: new URL('sw.js', appScope).href };
  await dispatchLifecycle('install');
  assert.equal(skipWaitingCount, 1, 'an update waits for clients using the previous module set to close');
});

test('only exact public GET assets are intercepted and version queries map to the same snapshot', async () => {
  const cache = currentCache();
  const jsUrl = new URL('./app.js', appScope).href;
  const jsResponse = cache.entries.get(jsUrl);
  fetchCalls = [];
  globalThis.fetch = async () => { throw new Error('network must not be used for a cached module'); };

  const versioned = await dispatchFetch(`${jsUrl}?v=build-24`);
  assert.equal(versioned.intercepted, true);
  assert.equal(versioned.response.body, jsResponse.body);
  assert.equal(fetchCalls.length, 0);

  for (const [url, init] of [
    [new URL('../data/notes.json', appScope).href, {}],
    [new URL('../read/2026/index.html', appScope).href, {}],
    [new URL('./app.js', appScope).href, { method: 'POST' }],
    [`${new URL('../data/2026.json', appScope).href}?token=private`, {}],
    [new URL('../data/2026.json', appScope).href, { headers: { authorization: 'Bearer private' } }],
    [new URL('../data/2026.json', appScope).href, { headers: { range: 'bytes=0-15' } }],
    ['https://cdn.jsdelivr.net/npm/other@1.0.0/module.js', { mode: 'cors' }],
  ]) {
    assert.equal((await dispatchFetch(url, init)).intercepted, false, `must pass through ${url}`);
  }
  assert.equal(fetchCalls.length, 0);
});

test('app-root campaign navigation maps to cached index while private query data passes through', async () => {
  const cache = currentCache();
  const indexUrl = new URL('./index.html', appScope).href;
  const campaign = await dispatchFetch(`${appScope.href}?campaign=offline#article`, { mode: 'navigate', credentials: 'include' });
  assert.equal(campaign.intercepted, true);
  assert.equal(campaign.response.body, cache.entries.get(indexUrl).body);
  assert.equal(fetchCalls.length, 0);
  const publicStyle = await dispatchFetch(new URL('./style.css', appScope).href, { credentials: 'include' });
  assert.equal(publicStyle.intercepted, true, 'browser-owned credentials are accepted only for an exact public static asset');
  assert.equal(publicStyle.response.body, cache.entries.get(new URL('./style.css', appScope).href).body);
  const publicEdition = await dispatchFetch(new URL('../data/2026.json', appScope).href, { credentials: 'include' });
  assert.equal(publicEdition.intercepted, true, 'the exact published edition snapshot is public and static');
  assert.equal((await dispatchFetch(new URL('../data/notes.json', appScope).href, { credentials: 'include' })).intercepted, false);
  for (const name of ['token', 'session', 'user']) {
    const result = await dispatchFetch(`${appScope.href}?${name}=private#article`, { mode: 'navigate', credentials: 'include' });
    assert.equal(result.intercepted, false, `${name} query is never cached`);
  }
});

test('CDN errors, opaque responses, partial responses, and quota failures never enter the cache', async () => {
  const cache = currentCache();
  const cdnUrl = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  cache.entries.delete(cdnUrl);
  fetchCalls = [];
  globalThis.fetch = async request => {
    fetchCalls.push(request);
    if (request.url === cdnUrl) return makeResponse(request.url, 503, 'cors');
    return makeResponse(request.url, 206, 'basic');
  };

  const failedCdn = await dispatchFetch(cdnUrl, { mode: 'cors' });
  assert.equal(failedCdn.intercepted, true);
  assert.equal(failedCdn.response.status, 503);
  assert.equal(cache.entries.has(cdnUrl), false);

  const coverUrl = new URL('../assets/cover-2026.webp', appScope).href;
  cache.entries.delete(coverUrl);
  const partial = await dispatchFetch(coverUrl);
  assert.equal(partial.response.status, 206);
  assert.equal(cache.entries.has(coverUrl), false);

  cache.failPut = true;
  globalThis.fetch = async request => makeResponse(request.url);
  const quota = await dispatchFetch(coverUrl);
  assert.equal(quota.response.status, 200);
  assert.equal(cache.entries.has(coverUrl), false);
  cache.failPut = false;

  const orbitUrl = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
  cache.entries.delete(orbitUrl);
  globalThis.fetch = async request => makeResponse(request.url, 0, 'opaque');
  const opaque = await dispatchFetch(orbitUrl, { mode: 'cors' });
  assert.equal(opaque.response.type, 'opaque');
  assert.equal(cache.entries.has(orbitUrl), false);
});

test('uncached CDN modules still use the network and successful CORS modules become cache-first', async () => {
  const cache = currentCache();
  const cdnUrl = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  cache.entries.delete(cdnUrl);
  let online = true;
  let calls = 0;
  globalThis.fetch = async request => {
    calls++;
    if (!online) throw new Error('offline');
    return makeResponse(request.url, 200, 'cors');
  };

  const first = await dispatchFetch(cdnUrl, { mode: 'cors' });
  assert.equal(first.response.status, 200);
  assert.equal(first.response.type, 'cors');
  assert.equal(calls, 1);
  assert.equal(cache.entries.has(cdnUrl), true);

  online = false;
  const offline = await dispatchFetch(cdnUrl, { mode: 'cors' });
  assert.equal(offline.response.body, first.response.body);
  assert.equal(calls, 1);
});
