import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

// Diagnostic sampling adds overhead. Use the series harness for latency claims.
const directory = 'test-results/immersive-startup-diagnostic';
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_250_000, uploadThroughput: 625_000, connectionType: 'cellular4g' });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?profile=startup-diagnostic`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.immersive?.world?.getRenderState().renderedFrames > 0, null, { timeout: 45000 });
  const { profile } = await cdp.send('Profiler.stop');
  const state = await page.evaluate(() => ({ fallback: document.body.classList.contains('fallback'), world: window.immersive.world.getState(), render: window.immersive.world.getRenderState() }));
  assert.equal(state.fallback, false);
  assert.equal(state.world.renderedIslandCount, 22);
  assert.ok(state.render.renderedFrames > 0);
  assert.deepEqual(errors, []);
  const sampledTime = new Map();
  for (let index = 0; index < (profile.samples?.length || 0); index++) {
    const id = profile.samples[index];
    sampledTime.set(id, (sampledTime.get(id) || 0) + (profile.timeDeltas?.[index] || 0));
  }
  const functions = profile.nodes.map(node => ({ function: node.callFrame.functionName || '(anonymous)', url: node.callFrame.url, line: node.callFrame.lineNumber + 1, sampledMs: (sampledTime.get(node.id) || 0) / 1000 })).sort((a, b) => b.sampledMs - a.sampledMs);
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/startup.cpuprofile`, JSON.stringify(profile));
  await writeFile(`${directory}/summary.json`, JSON.stringify({ note: 'Sample weights from one instrumented diagnostic run, not a latency benchmark.', functions, state, errors }, null, 2));
  console.log(JSON.stringify({ functions: functions.slice(0, 15), errors }, null, 2));
} finally {
  await browser.close();
  server.httpServer.closeAllConnections();
  await server.close();
}
