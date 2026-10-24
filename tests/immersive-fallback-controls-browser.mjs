import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const output = 'test-results/immersive-fallback-controls';
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [], errors = [];

try {
  const blocked = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  blocked.on('pageerror', error => errors.push(error.message));
  const blockedCdnRequests = [];
  await blocked.route('https://cdn.jsdelivr.net/**', route => { blockedCdnRequests.push(route.request().url()); return route.abort(); });
  await blocked.goto(`${origin}/immersive/index.html`);
  await blocked.waitForFunction(() => document.body.classList.contains('fallback') && window.immersive);
  await blocked.waitForTimeout(250);
  const coldFallback = await blocked.evaluate(() => ({
    world: window.immersive.world,
    messageVisible: !document.querySelector('#fallback-hint').hidden,
    message: document.querySelector('#fallback-hint').textContent,
    replayHidden: document.querySelector('#replay-arrival').hidden,
    catalogVisible: !document.querySelector('#catalog').hidden,
    populationDisabled: document.querySelector('#population').disabled,
    seasonDisabled: document.querySelector('#season').disabled,
    motionEnabled: !document.querySelector('#motion').disabled,
    soundEnabled: !document.querySelector('#sound').disabled,
  }));
  assert.equal(coldFallback.world, null);
  assert.equal(coldFallback.messageVisible, true);
  assert.equal(coldFallback.replayHidden, true);
  assert.equal(coldFallback.catalogVisible, true);
  assert.equal(coldFallback.populationDisabled, true);
  assert.equal(coldFallback.seasonDisabled, true);
  assert.equal(coldFallback.motionEnabled, true);
  assert.equal(coldFallback.soundEnabled, true);
  assert.match(coldFallback.message, /島上人數與節慶設定暫停/);
  assert.ok(blockedCdnRequests.some(url => url.includes('/three@0.160.0/')));
  await blocked.screenshot({ path: `${output}/cold-cdn-fallback.png` });

  await blocked.locator('#read').click();
  await blocked.locator('[data-depth="full"]').click();
  const fullTextLength = (await blocked.locator('#reading-content').innerText()).length;
  assert.ok(fullTextLength > 1000);
  await blocked.locator('#note').fill('2D 備援筆記');
  await blocked.waitForFunction(() => document.querySelector('#note-status').textContent === '已儲存在這個瀏覽器');
  await blocked.locator('#mark-read').click();
  await blocked.locator('#reader form button').click();
  await blocked.locator('#bookmark').click();
  assert.equal(await blocked.locator('#bookmark').innerText(), '已收藏');
  await blocked.locator('#read').click();
  assert.equal(await blocked.locator('#note').inputValue(), '2D 備援筆記');
  await blocked.locator('#reader form button').click();
  await blocked.locator('#map-toggle').click();
  await blocked.locator('#article-list button').filter({ hasText: 'P04' }).click();
  const catalogArticle = await blocked.locator('#chapter-label').innerText();
  assert.match(catalogArticle, /P04/);
  await blocked.locator('#interact').click();
  assert.equal(await blocked.locator('#game').evaluate(dialog => dialog.open), true);
  assert.ok(await blocked.locator('#game-controls button').count() > 0);
  await blocked.screenshot({ path: `${output}/fallback-reading-and-interaction.png` });
  records.push({ coldFallback, blockedCdnRequests, fullTextLength, note: 'saved', bookmark: 'saved', catalogArticle, twoDimensionalInteraction: 'available' });
  await blocked.close();

  const lost = await browser.newPage({ viewport: { width: 800, height: 600 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  lost.on('pageerror', error => errors.push(error.message));
  await lost.goto(`${origin}/immersive/index.html`);
  await lost.waitForFunction(() => window.immersive?.world, { timeout: 30000 });
  assert.equal(await lost.locator('#population').isDisabled(), false);
  assert.equal(await lost.locator('#season').isDisabled(), false);
  const extension = await lost.evaluate(() => {
    const gl = document.querySelector('#world').getContext('webgl2') || document.querySelector('#world').getContext('webgl');
    const lose = gl?.getExtension('WEBGL_lose_context');
    if (!lose) return false;
    lose.loseContext();
    return true;
  });
  assert.equal(extension, true, 'browser provided WEBGL_lose_context');
  await lost.waitForFunction(() => document.body.classList.contains('fallback') && window.immersive?.world === null);
  const contextLoss = await lost.evaluate(() => ({
    world: window.immersive.world,
    messageVisible: !document.querySelector('#fallback-hint').hidden,
    replayHidden: document.querySelector('#replay-arrival').hidden,
    catalogVisible: !document.querySelector('#catalog').hidden,
  }));
  assert.equal(contextLoss.world, null);
  assert.equal(contextLoss.messageVisible, true);
  assert.equal(contextLoss.replayHidden, true);
  assert.equal(contextLoss.catalogVisible, true);
  assert.equal(await lost.locator('#population').isDisabled(), true);
  assert.equal(await lost.locator('#season').isDisabled(), true);
  await lost.locator('#read').click();
  assert.ok((await lost.locator('#reader-title').innerText()).length > 0);
  await lost.screenshot({ path: `${output}/webgl-context-lost.png` });
  records.push({ contextLoss, webglLossMethod: 'WEBGL_lose_context.loseContext()', errors });
  await lost.close();

  assert.equal(errors.length, 0, errors.join('\\n'));
  await writeFile(`${output}/results.json`, JSON.stringify(records, null, 2));
  console.log(JSON.stringify({ records, output }));
} finally {
  await browser.close();
  server.httpServer.closeAllConnections?.();
  await server.close();
}
