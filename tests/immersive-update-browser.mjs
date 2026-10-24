import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const workerFile = 'dist/immersive/sw.js';
const originalWorker = await readFile(workerFile, 'utf8');
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const result = { previousCacheVersion: '2026-10-24.7', updateCacheVersion: '2026-10-24.8', noteSurvivesUpdate: false, newControllerActive: false };

try {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/immersive/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.immersive?.data, undefined, { timeout: 30000 });
  console.log('update-test: initial page controlled');
  await page.evaluate(async () => {
    document.querySelector('#read').click();
    document.querySelector('#note').value = '舊版開著時撰寫的離線筆記';
    document.querySelector('#note').dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
  });
  await page.waitForFunction(() => document.querySelector('#note-status').textContent.includes('已儲存'));
  console.log('update-test: note saved');
  const oldController = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);

  const v8Worker = originalWorker.replace("2026-10-24.7", "2026-10-24.8");
  assert.notEqual(v8Worker, originalWorker, 'test fixture must advertise a newer cache version');
  await writeFile(workerFile, v8Worker);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('./');
    await registration.update();
  });
  console.log('update-test: update check triggered');
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration('./'))?.waiting, undefined, { timeout: 30000 });
  console.log('update-test: new worker waiting');
  await page.waitForFunction(() => document.querySelector('#status').innerText.includes('新版本已準備好'));
  assert.equal(await page.locator('#status .update-action').innerText(), '套用更新');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
    page.locator('#reader-update button').click(),
  ]);
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL !== undefined && window.immersive?.data, undefined, { timeout: 30000 });
  await page.locator('#read').click();
  await page.waitForFunction(() => document.querySelector('#reader').open && document.querySelector('#note').value === '舊版開著時撰寫的離線筆記', undefined, { timeout: 10000 });
  await page.waitForFunction(async () => {
    const cacheNames = await caches.keys();
    return cacheNames.some(name => name.endsWith('2026-10-24.8'));
  }, undefined, { timeout: 10000 });
  result.newControllerActive = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL !== undefined && document.querySelector('#note').value === '舊版開著時撰寫的離線筆記');
  result.noteSurvivesUpdate = await page.locator('#note').inputValue() === '舊版開著時撰寫的離線筆記';
  result.oldController = oldController;
  result.newController = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);
  assert.equal(result.noteSurvivesUpdate, true);
  assert.match(result.newController, /\/immersive\/sw\.js$/);
  await mkdir('test-results/immersive-ux-journey', { recursive: true });
  await writeFile('test-results/immersive-ux-journey/update.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
  await writeFile(workerFile, originalWorker);
}
