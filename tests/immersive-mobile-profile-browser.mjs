import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_250_000, uploadThroughput: 625_000, connectionType: 'cellular4g' });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const started = Date.now();
  await page.goto(`${origin}/?profile=mobile`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => location.pathname.endsWith('/immersive/'), { timeout: 10000 });
  await page.waitForFunction(() => window.immersive?.world, { timeout: 20000 });
  const worldReadyMs = Date.now() - started;
  await page.waitForFunction(() => window.immersive?.world?.getRenderState?.().renderedFrames > 0, { timeout: 20000 });
  const firstDrawMs = Date.now() - started;
  await mkdir('test-results/immersive-mobile-profile', { recursive: true });
  await page.locator('#world').screenshot({ path: 'test-results/immersive-mobile-profile/first-draw.png', timeout: 10000 });
  const readyState = await page.evaluate(() => ({ render: window.immersive.world.getRenderState(), world: window.immersive.world.getState(), pixelRatio: window.devicePixelRatio }));

  const npcStarted = Date.now();
  await page.evaluate(() => {
    window.immersive.world.setPopulation(100);
    window.immersive.world.setEncounter('achi', 99);
    window.immersive.world.setSpeech('芬姐：「先別急，我看看你卡在哪一步。」');
  });
  await page.waitForFunction(() => window.immersive.world.getState().encounter?.npcIndex === 99 && window.immersive.world.getState().speech.length > 0);
  const npcReadyMs = Date.now() - npcStarted;
  const npcState = await page.evaluate(() => window.immersive.world.getState());

  const gameStarted = Date.now();
  await page.locator('#interact').click();
  await page.getByRole('button', { name: '把資訊放上證據桌', exact: true }).click();
  await page.locator('#game-after:not([hidden])').waitFor();
  const gameResultMs = Date.now() - gameStarted;
  const gameResult = await page.locator('#game-result').innerText();
  const results = { profile: { viewport: '390x844', deviceScaleFactor: 2, latencyMs: 150, downloadMbps: 10, cpuThrottle: 4, reducedMotion: true, coldContext: true, browser: 'Chromium SwiftShader' }, worldReadyMs, firstDrawMs, firstDrawFrames: readyState.render.renderedFrames, pixelRatio: readyState.pixelRatio, npc100: { count: npcState.population, selectedNpc: npcState.encounter.npcIndex, speech: npcState.speech, readyMs: npcReadyMs }, game: { resultCharacters: gameResult.length, resultMs: gameResultMs } };
  await mkdir('test-results/immersive-mobile-profile', { recursive: true });
  await writeFile('test-results/immersive-mobile-profile/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
