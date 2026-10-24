import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : '@playwright/test');
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const base = process.env.TEST_URL || 'http://127.0.0.1:4186/immersive/';
try {
  await page.goto(base);
  await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 20000 });
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    if (!names.some(name => name.startsWith('decision-immersive:'))) return false;
    const name = names.find(name => name.startsWith('decision-immersive:'));
    const cache = await caches.open(name);
    return (await cache.keys()).length >= 25;
  }, { timeout: 15000 });
  const inventory = await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('decision-immersive:'));
    const cache = await caches.open(name);
    return (await cache.keys()).map(request => new URL(request.url).pathname).sort();
  });
  await page.locator('#read').click();
  await page.locator('#reader[open]').waitFor();
  await page.locator('[data-depth="full"]').click();
  const articleBefore = await page.locator('#reading-content').innerText();
  assert.ok(articleBefore.length > 1000, `full article available online (${articleBefore.length} chars)`);
  await page.locator('#note').fill('離線筆記回存驗收：保留這段紀錄。');
  await page.getByText('已儲存在這個瀏覽器').waitFor();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#dialogue')?.textContent?.length > 0, { timeout: 10000 });
  await page.locator('#read').click();
  await page.locator('#reader[open]').waitFor();
  await page.locator('[data-depth="full"]').click();
  const articleOffline = await page.locator('#reading-content').innerText();
  assert.equal(articleOffline, articleBefore, 'full source article is identical offline');
  assert.equal(await page.locator('#note').inputValue(), '離線筆記回存驗收：保留這段紀錄。');
  await page.locator('#note').fill('離線編輯後重新載入：這段筆記已保存。');
  await page.getByText('已儲存在這個瀏覽器').waitFor();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#dialogue')?.textContent?.length > 0, { timeout: 10000 });
  await page.locator('#read').click();
  await page.locator('#reader[open]').waitFor();
  assert.equal(await page.locator('#note').inputValue(), '離線編輯後重新載入：這段筆記已保存。');
  const results = { url: page.url(), cachedEntries: inventory.length, inventory, fullArticleCharacters: articleOffline.length, offlineEditReload: true };
  await mkdir('test-results/immersive-offline', { recursive: true });
  await writeFile('test-results/immersive-offline/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
