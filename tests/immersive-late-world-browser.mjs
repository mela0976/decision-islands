import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const moduleDelayMs = 5000;
let worldModuleRequests = 0;
async function holdWorldModule(page, delayMs = moduleDelayMs) {
  await page.route(/(?:\/immersive\/world\.js|\/assets\/world-[^/]+\.js)(?:\?.*)?$/, async route => {
    worldModuleRequests++;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.continue();
  });
}
try {
  const gameContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const gamePage = await gameContext.newPage();
  const errors = [];
  gamePage.on('pageerror', error => errors.push(error.message));
  await holdWorldModule(gamePage);
  await gamePage.goto(`${origin}/?late=game`);
  await gamePage.locator('#interact:enabled').waitFor();
  await gamePage.locator('#interact').click();
  await gamePage.getByRole('button', { name: '把資訊放上證據桌', exact: true }).click();
  await gamePage.locator('#game-after:not([hidden])').waitFor();
  const resultBeforeWorld = await gamePage.locator('#game-result').textContent();
  await gamePage.locator('#compare').click();
  await gamePage.locator('#compare').click();
  assert.equal(await gamePage.evaluate(() => Boolean(window.immersive?.world)), false, 'game finishes while world module is delayed');
  await gamePage.waitForFunction(() => window.immersive?.world, { timeout: 15000 });
  const worldAfterGame = await gamePage.evaluate(() => window.immersive.world.getState());
  assert.equal(worldAfterGame.current, '2026-01');
  assert.equal(worldAfterGame.interaction.kind, 'judgment');
  assert.equal(worldAfterGame.interaction.before, false);
  assert.ok(worldAfterGame.interaction.outcomeObjectCount > 0, 'the completed choice is applied to the late world');
  assert.match(worldAfterGame.speech, /映蓁把卡片分到證據桌/);
  assert.equal(await gamePage.locator('#game-result').textContent(), resultBeforeWorld);

  const readContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const readPage = await readContext.newPage();
  await holdWorldModule(readPage);
  await readPage.goto(`${origin}/?late=reading`);
  await readPage.locator('#read:enabled').waitFor();
  await readPage.locator('#read').click();
  await readPage.locator('#reader[open]').waitFor();
  await readPage.locator('[data-depth="full"]').click();
  const fullText = await readPage.locator('#reading-content').innerText();
  await readPage.locator('#note').fill('世界尚在載入時，全文與筆記照常可用。');
  await readPage.getByText('已儲存在這個瀏覽器').waitFor();
  await readPage.waitForFunction(() => window.immersive?.world, { timeout: 15000 });
  const paused = await readPage.evaluate(() => window.immersive.world.getRenderState());
  assert.equal(paused.active, false, 'late world honors an already-open reader');
  assert.equal(await readPage.locator('#note').inputValue(), '世界尚在載入時，全文與筆記照常可用。');
  assert.ok(fullText.length > 1000);
  assert.deepEqual(errors, []);
  assert.equal(worldModuleRequests, 2, 'both independently delayed page contexts must request the world module');
  const result = { moduleDelayMs, worldModuleRequests, serviceWorkers: 'blocked for deterministic network delay', game: { resultCharacters: resultBeforeWorld.length, interaction: worldAfterGame.interaction.layout, dialogue: worldAfterGame.speech }, reading: { characters: fullText.length, rendererActiveWhileReaderOpen: paused.active, noteRestored: true } };
  await mkdir('test-results/immersive-late-world', { recursive: true });
  await writeFile('test-results/immersive-late-world/results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await gameContext.close();
  await readContext.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
