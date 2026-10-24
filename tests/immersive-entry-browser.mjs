import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('requestfailed', request => browserErrors.push(`${request.url()} :: ${request.failure()?.errorText}`));
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const startedAt = Date.now();
  await page.goto(`${origin}/?campaign=entry#article`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => location.pathname.endsWith('/immersive/'), { timeout: 5000 });
  await page.waitForFunction(() => window.immersive?.world, { timeout: 30000 });
  const mobileInteractiveMs = Date.now() - startedAt;
  assert.equal(await page.evaluate(() => window.immersive.data.articles.length), 22);
  assert.equal(new URL(page.url()).search, '?campaign=entry');
  assert.equal(new URL(page.url()).hash, '#article');
  await page.locator('#read').click();
  await page.locator('#reader[open]').waitFor();
  await page.locator('[data-depth="full"]').click();
  const fullText = await page.locator('#reading-content').innerText();
  assert.ok(fullText.length > 1000);
  await page.waitForFunction(async () => (await navigator.serviceWorker?.getRegistrations() ?? []).some(registration => new URL(registration.scope).pathname === '/'));
  await page.waitForFunction(async () => (await navigator.serviceWorker?.getRegistrations() ?? []).some(registration => new URL(registration.scope).pathname.endsWith('/immersive/')));
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => location.pathname.endsWith('/immersive/'), { timeout: 5000 });
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    const shell = names.find(name => name.startsWith('decision-islands-shell:'));
    if (!shell) return false;
    const cache = await caches.open(shell);
    return (await cache.keys()).some(request => new URL(request.url).pathname === '/');
  }, { timeout: 10000 });
  const immersiveCacheInventory = await page.evaluate(async () => {
    const name = (await caches.keys()).find(value => value.startsWith('decision-immersive:'));
    const cache = await caches.open(name);
    return (await cache.keys()).map(request => request.url).sort();
  });
  const cachedUrls = new Set(immersiveCacheInventory);
  const requiredLocal = [`${origin}/immersive/index.html`, `${origin}/immersive/app.js`, `${origin}/immersive/data.js`, `${origin}/immersive/world.js`, `${origin}/immersive/intro.js`, `${origin}/immersive/progress.js`, `${origin}/immersive/cache.js`, `${origin}/immersive/style.css`, `${origin}/immersive/contrast.css`, `${origin}/data/2026.json`, `${origin}/fonts/publication.css`, `${origin}/assets/cover-2026.webp`, ...Array.from({ length: 11 }, (_, index) => `${origin}/fonts/publication-${index === 0 ? 'latin-2a33d5d6a5' : index === 1 ? 'tc-supplement-0537efd18e' : `tw-variable-${index - 2}-${['a744bc8b6c','6cb5b4634b','773e05b1bc','81c18e680d','57e2764204','5d4b6c9d18','4358d63bf0','0b34eb3fe3','7a1dc60589'][index - 2]}`}.woff2`)];
  const requiredCdn = ['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js'];
  const missingOptional = requiredLocal.slice(11).concat(requiredCdn).filter(url => !cachedUrls.has(url));
  assert.ok(requiredLocal.slice(0, 11).every(url => cachedUrls.has(url)), 'all app core files are cached');
  assert.deepEqual(missingOptional, [], 'all optional cover/font/CDN resources are present');
  assert.equal(immersiveCacheInventory.length, 25);
  await page.context().setOffline(true);
  await page.goto(`${origin}/?campaign=offline#article`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => location.pathname.endsWith('/immersive/'), { timeout: 10000 });
  try { await page.waitForFunction(() => window.immersive?.world, { timeout: 20000 }); }
  catch (error) {
    const diagnostic = await page.evaluate(async () => ({ url: location.href, title: document.title, importmap: document.querySelector('script[type="importmap"]')?.textContent, controller: navigator.serviceWorker.controller?.scriptURL, text: document.body.innerText.slice(0, 500), registrations: (await navigator.serviceWorker.getRegistrations()).map(registration => ({ scope: registration.scope, active: registration.active?.scriptURL, waiting: registration.waiting?.scriptURL })), caches: await Promise.all((await caches.keys()).map(async name => ({ name, urls: (await (await caches.open(name)).keys()).map(request => request.url) }))) })).catch(() => null);
    console.error(JSON.stringify({ diagnostic, browserErrors }, null, 2));
    throw error;
  }
  assert.equal(new URL(page.url()).search, '?campaign=offline');
  assert.equal(new URL(page.url()).hash, '#article');
  await page.locator('#read').click();
  await page.locator('[data-depth="full"]').click();
  assert.equal(await page.locator('#reading-content').innerText(), fullText, 'the root URL reaches full source text offline');
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(`${origin}/`);
  assert.equal(await noJsPage.locator('noscript a[href="./read/2026/index.html"]').count(), 1);
  await noJs.close();
  const results = { entryPath: '/', finalPath: new URL(page.url()).pathname, islandCount: await page.evaluate(() => window.immersive.data.islands.length), articleCharacters: fullText.length, mobileInteractiveMs, noJsSourceFallback: true, rootOfflineReload: true, appOfflineReload: true, immersiveCacheEntries: immersiveCacheInventory.length, cachedFonts: immersiveCacheInventory.filter(url => url.endsWith('.woff2')).length, cachedThreeModules: immersiveCacheInventory.filter(url => url.startsWith('https://cdn.jsdelivr.net/npm/three@0.160.0/')).length, missingOptional };
  results.rootOfflineReload = true;
  await mkdir('test-results/immersive-entry', { recursive: true });
  await writeFile('test-results/immersive-entry/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
