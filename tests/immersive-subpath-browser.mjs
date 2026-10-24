import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const dist = resolve('dist');
const mime = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.woff2', 'font/woff2'], ['.webp', 'image/webp'], ['.png', 'image/png']]);
const server = createServer(async (request, response) => {
  const base = '/decision-islands/';
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname !== base.slice(0, -1) && !pathname.startsWith(base)) { response.writeHead(404).end(); return; }
  const relative = pathname === base || pathname === base.slice(0, -1) ? 'index.html' : decodeURIComponent(pathname.slice(base.length));
  const fileRelative = relative.endsWith('/') ? `${relative}index.html` : relative;
  const path = resolve(dist, fileRelative);
  if (path !== dist && !path.startsWith(`${dist}${sep}`)) { response.writeHead(400).end(); return; }
  try {
    const body = await readFile(path);
    const ext = path.slice(path.lastIndexOf('.'));
    response.writeHead(200, { 'content-type': mime.get(ext) || 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const started = Date.now();
  await page.goto(`${origin}/decision-islands/?campaign=base#article`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => location.pathname === '/decision-islands/immersive/');
  await page.waitForFunction(() => window.immersive?.world, { timeout: 30000 });
  assert.equal(new URL(page.url()).search, '?campaign=base');
  assert.equal(new URL(page.url()).hash, '#article');
  assert.equal(await page.evaluate(() => window.immersive.data.islands.length), 22);
  await page.locator('#read').click();
  await page.locator('[data-depth="full"]').click();
  const text = await page.locator('#reading-content').innerText();
  assert.ok(text.length > 1000);
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).some(item => new URL(item.scope).pathname === '/decision-islands/immersive/'));
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).some(item => new URL(item.scope).pathname === '/decision-islands/'));
  await page.context().setOffline(true);
  await page.goto(`${origin}/decision-islands/?campaign=offline#article`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => location.pathname === '/decision-islands/immersive/', { timeout: 10000 });
  await page.waitForFunction(() => window.immersive?.world, { timeout: 20000 });
  assert.equal(await page.locator('#read').isEnabled(), true);
  await page.locator('#read').click();
  await page.locator('[data-depth="full"]').click();
  assert.equal(await page.locator('#reading-content').innerText(), text);
  const result = { basePath: '/decision-islands/', onlineEntry: true, finalOnlinePath: '/decision-islands/immersive/', queryHashPreserved: true, islandCount: 22, fullArticleCharacters: text.length, rootAndAppServiceWorkerScopes: ['/decision-islands/', '/decision-islands/immersive/'], offlineRootReentry: true, rootToWorldMs: Date.now() - started };
  await mkdir('test-results/immersive-subpath', { recursive: true });
  await writeFile('test-results/immersive-subpath/results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await new Promise(resolveDone => server.close(resolveDone));
}
