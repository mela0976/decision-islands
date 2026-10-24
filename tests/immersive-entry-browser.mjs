import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { editorialTextureKey } from '../public/immersive/editorial-textures.js';
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function closeServerWithTimeout(timeoutMs = 5000) {
  server.httpServer.closeAllConnections?.();
  let timer;
  try {
    await Promise.race([
      server.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Vite preview did not close within ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
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
  const requiredCore = [
    'immersive/index.html', 'immersive/app.js', 'immersive/data.js',
    'immersive/world.js', 'immersive/editorial-textures.js',
    'immersive/character-events.js', 'immersive/arrival-events.js',
    'immersive/intro.js', 'immersive/progress.js', 'immersive/cache.js',
    'immersive/style.css', 'immersive/contrast.css', 'data/2026.json',
    'fonts/publication.css',
  ].map(path => `${origin}/${path}`);
  const fontCss = await readFile('public/fonts/publication.css', 'utf8');
  const fontManifest = JSON.parse(await readFile('public/fonts/manifest.json', 'utf8'));
  const fontFiles = [...fontCss.matchAll(/src:url\("([^"]+\.woff2)"\)/g)].map(match => match[1]);
  assert.equal(new Set(fontFiles).size, 12, 'the publication snapshot includes the added native UI glyph shard');
  assert.equal(fontFiles.length, 12, 'font faces reference twelve distinct WOFF2 files');
  const latinFile = fontCss.match(/font-family:"Publication Latin";[^}]*src:url\("([^"]+)"\)/)?.[1];
  assert.ok(latinFile, 'the Latin publication face is declared');
  assert.deepEqual(new Set(fontFiles), new Set([...fontManifest.files.map(file => file.file), latinFile]), 'the cache inventory covers the complete declared font manifest');
  assert.ok(fontFiles.includes('publication-tw-ui-b805e5526e.woff2'), 'the corrected native UI glyph outlines are included');
  const requiredOptional = [`${origin}/assets/cover-2026.webp`, ...fontFiles.map(file => `${origin}/fonts/${file}`)];
  const requiredLocal = [...requiredCore, ...requiredOptional];
  const requiredCdn = ['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js'];
  const missingOptional = requiredOptional.concat(requiredCdn).filter(url => !cachedUrls.has(url));
  assert.ok(requiredCore.every(url => cachedUrls.has(url)), 'all app core files are cached, including the arrival controller');
  assert.deepEqual(missingOptional, [], 'all optional cover/font/CDN resources are present');
  assert.equal(immersiveCacheInventory.length, new Set([...requiredLocal, ...requiredCdn]).size);
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
  await page.locator('#reader form .close').click();
  const builtP01Id = await page.evaluate(() => window.immersive.data.islands.find(candidate => candidate.id === 'P01')?.articleId);
  assert.ok(builtP01Id, 'the built edition resolves P01 through its canonical island record');
  const beforeBuiltP01 = await page.evaluate(() => ({ state: window.immersive.world.getState(), render: window.immersive.world.getRenderState() }));
  assert.equal(beforeBuiltP01.state.preparedIslandCount, 1, 'built offline entry prepares only the initial island');
  assert.equal(beforeBuiltP01.render.editorialTextureCount, 1, 'built entry prepares the current proposal texture');
  await page.evaluate(id => window.immersive.visit(id, null, false), builtP01Id);
  await page.waitForFunction(id => window.immersive.world.getState().current === id, builtP01Id);
  await page.waitForFunction(() => window.immersive.world.getRenderState().renderedFrames >= 8);
  const builtP01 = await page.evaluate(() => ({
    state: window.immersive.world.getState(),
    render: window.immersive.world.getRenderState(),
    configs: window.immersive.data.visualThemes.find(t => t.chapterId === 'people').editorialMotifs.P01,
  }));
  const builtMotifs = builtP01.state.editorialMotifs.map(motif => motif.motifId);
  for (const motif of ['flowerPaper', 'sourcePortrait', 'simulatedPortrait']) assert.ok(builtMotifs.includes(motif), `built offline P01 renders ${motif}`);
  const requiredP01Keys = Object.values(builtP01.configs).map(editorialTextureKey);
  const expectedBuiltKeys = new Set([...beforeBuiltP01.render.editorialTextureKeys, ...requiredP01Keys]);
  assert.deepEqual([...builtP01.render.editorialTextureKeys].sort(), [...expectedBuiltKeys].sort(), 'built P01 loads the required flower and two portraits without preparing unrelated scenes');
  assert.equal(builtP01.render.editorialTextureCount, expectedBuiltKeys.size);
  assert.equal(builtP01.state.preparedIslandCount, 2);
  await mkdir('test-results/immersive-editorial/built', { recursive: true });
  await page.locator('#world').screenshot({ path: 'test-results/immersive-editorial/built/390-P01-offline-built.png' });
  const disposedBuiltWorld = await page.evaluate(() => {
    window.immersive.world.dispose();
    return window.immersive.world.getRenderState();
  });
  assert.deepEqual(disposedBuiltWorld.editorialTextureKeys, []);
  assert.equal(disposedBuiltWorld.editorialTextureCount, 0, 'built P01 releases shared textures on dispose');
  assert.equal(disposedBuiltWorld.ownedTextureCount, 0);
  assert.equal(disposedBuiltWorld.ownedMaterialCount, 0);
  assert.equal(disposedBuiltWorld.ownedGeometryCount, 0);
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(`${origin}/`);
  assert.equal(await noJsPage.locator('noscript a[href="./read/2026/index.html"]').count(), 1);
  await noJs.close();
  const results = { entryPath: '/', finalPath: new URL(page.url()).pathname, islandCount: await page.evaluate(() => window.immersive.data.islands.length), articleCharacters: fullText.length, builtOfflineMotifs: builtMotifs, builtOfflineTextureCount: builtP01.render.editorialTextureCount, builtOfflineDispose: { editorialTextures: disposedBuiltWorld.editorialTextureCount, textures: disposedBuiltWorld.ownedTextureCount, materials: disposedBuiltWorld.ownedMaterialCount, geometries: disposedBuiltWorld.ownedGeometryCount }, mobileInteractiveMs, noJsSourceFallback: true, rootOfflineReload: true, appOfflineReload: true, immersiveCacheEntries: immersiveCacheInventory.length, cachedFonts: immersiveCacheInventory.filter(url => url.endsWith('.woff2')).length, cachedThreeModules: immersiveCacheInventory.filter(url => url.startsWith('https://cdn.jsdelivr.net/npm/three@0.160.0/')).length, missingOptional };
  results.rootOfflineReload = true;
  await mkdir('test-results/immersive-entry', { recursive: true });
  await writeFile('test-results/immersive-entry/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await closeServerWithTimeout();
}
