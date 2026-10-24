import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('__profileStartedAt')) sessionStorage.setItem('__profileStartedAt', String(Date.now()));
    const timing = window.__immersiveTiming = { firstDrawAt: null, firstPresentedAt: null, drawCalls: 0, firstDrawCallMs: 0 };
    const methods = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements'];
    for (const constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!constructor) continue;
      for (const method of methods) {
        const original = constructor.prototype[method];
        if (typeof original !== 'function' || original.__profileWrapped) continue;
        const wrapped = function (...args) {
          const began = performance.now();
          const first = timing.firstDrawAt === null;
          if (first) timing.firstDrawAt = Date.now();
          timing.drawCalls++;
          try { return original.apply(this, args); }
          finally {
            if (first) {
              timing.firstDrawCallMs = performance.now() - began;
              requestAnimationFrame(() => requestAnimationFrame(() => { timing.firstPresentedAt = Date.now(); }));
            }
          }
        };
        wrapped.__profileWrapped = true;
        constructor.prototype[method] = wrapped;
      }
    }
  });
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
  await page.waitForFunction(() => window.__immersiveTiming?.firstPresentedAt !== null, { timeout: 20000 });
  const drawTiming = await page.evaluate(() => ({ ...window.__immersiveTiming, start: Number(sessionStorage.getItem('__profileStartedAt')) }));
  const firstDrawMs = drawTiming.firstDrawAt - drawTiming.start;
  const firstPresentedMs = drawTiming.firstPresentedAt - drawTiming.start;
  await mkdir('test-results/immersive-mobile-profile', { recursive: true });
  await page.locator('#world').screenshot({ path: 'test-results/immersive-mobile-profile/first-draw.png', timeout: 10000 });
  const readyState = await page.evaluate(() => ({ render: window.immersive.world.getRenderState(), world: window.immersive.world.getState(), pixelRatio: window.devicePixelRatio }));
  assert.ok(readyState.world.characters.every(character => !character.nameLabelVisible), 'mobile cast nameplates must not cover the scene');
  await page.waitForFunction(() => window.immersive.world.getRenderState().shadowCasting, { timeout: 5000 });
  const shadowsRestoredAt = Date.now();
  const restoredRenderer = await page.evaluate(() => window.immersive.world.getRenderState());

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
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: new URL(entry.name).pathname, startMs: Math.round(entry.startTime), durationMs: Math.round(entry.duration), transferBytes: entry.transferSize, decodedBytes: entry.decodedBodySize, initiator: entry.initiatorType })).filter(entry => /three|OrbitControls|world\.js|data\.js|2026\.json|publication|woff2/.test(entry.name)));
  const results = { profile: { viewport: '390x844', deviceScaleFactor: 2, latencyMs: 150, downloadMbps: 10, cpuThrottle: 4, reducedMotion: true, coldContext: true, browser: 'Chromium SwiftShader' }, worldReadyMs, firstDrawMs, firstPresentedMs, firstDrawCallMs: drawTiming.firstDrawCallMs, drawCallsToFirstPresented: drawTiming.drawCalls, worldSetupMs: readyState.render.setupMs, firstDrawFrames: readyState.render.renderedFrames, renderer: { drawCalls: readyState.render.drawCalls, triangles: readyState.render.triangles, textures: readyState.render.textureCount, programs: readyState.render.programCount, shadowEnabled: readyState.render.shadowEnabled, shadowCastingOnCapture: readyState.render.shadowCasting, shadowCastingAtFirstDraw: readyState.render.firstDrawShadowCasting, shadowRestoreFromFirstDrawMs: readyState.render.shadowRestoreMs, shadowRestoredWithinProfileMs: shadowsRestoredAt - (started + firstPresentedMs), drawCallsAfterShadowRestore: restoredRenderer.drawCalls, programsAfterShadowRestore: restoredRenderer.programCount }, resources, pixelRatio: readyState.pixelRatio, npc100: { count: npcState.population, selectedNpc: npcState.encounter.npcIndex, speech: npcState.speech, readyMs: npcReadyMs }, game: { resultCharacters: gameResult.length, resultMs: gameResultMs } };
  await mkdir('test-results/immersive-mobile-profile', { recursive: true });
  await writeFile('test-results/immersive-mobile-profile/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
