import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('dentsu-decision-2026-explore-tip', 'dismissed'));
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.immersive?.world);
  await page.waitForFunction(async () => {
    const names = await caches.keys(), name = names.find(name => name.startsWith('decision-immersive:'));
    if (!name) return false;
    const cache = await caches.open(name);
    return (await cache.match(new URL('./arrival-events.js', location.href).href)) && (await cache.keys()).filter(request => request.url.startsWith('https://cdn.jsdelivr.net/npm/three@0.160.0/')).length === 2;
  }, { timeout: 30000 });
  const expected = await readFile('public/immersive/arrival-events.js', 'utf8');
  const cached = await page.evaluate(async () => {
    const name = (await caches.keys()).find(name => name.startsWith('decision-immersive:'));
    const cache = await caches.open(name), url = new URL('./arrival-events.js', location.href).href;
    return { name, text: await (await cache.match(url)).text(), entries: (await cache.keys()).length, scopes: (await navigator.serviceWorker.getRegistrations()).map(registration => registration.scope) };
  });
  assert.equal(cached.text, expected, 'offline cache contains exact built arrival module');
  assert.ok(cached.scopes.some(scope => new URL(scope).pathname === '/'));
  assert.ok(cached.scopes.some(scope => new URL(scope).pathname === '/immersive/'));
  await context.setOffline(true);
  await page.goto(origin);
  await page.waitForFunction(() => window.immersive?.world);
  await page.locator('#replay-arrival').click();
  const rootArrival = await page.evaluate(() => window.immersive.world.getState().arrivalEvent);
  assert.equal(rootArrival.complete, true); assert.ok(rootArrival.props.length > 0);
  await page.goto(`${origin}/immersive/`);
  await page.waitForFunction(() => window.immersive?.world);
  await page.locator('#replay-arrival').click();
  const appArrival = await page.evaluate(() => window.immersive.world.getState().arrivalEvent);
  assert.equal(appArrival.complete, true);
  assert.deepEqual(appArrival.props, rootArrival.props, 'offline root and app workers preserve same arrival final');
  const fetched = await page.evaluate(async () => (await fetch('./arrival-events.js')).text());
  assert.equal(fetched, expected);
  assert.equal(errors.length, 0, errors.join('\n'));
  await mkdir('test-results/immersive-arrival-offline', { recursive: true });
  await writeFile('test-results/immersive-arrival-offline/results.json', JSON.stringify({ cacheName: cached.name, cacheEntries: cached.entries, scopes: cached.scopes, moduleBytes: Buffer.byteLength(expected), rootArrival, appArrival, errors }, null, 2));
  console.log(JSON.stringify({ cacheName: cached.name, cacheEntries: cached.entries, moduleBytes: Buffer.byteLength(expected), errors }));
} finally { await browser.close(); server.httpServer.closeAllConnections?.(); await server.close(); }
