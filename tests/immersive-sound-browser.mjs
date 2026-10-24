import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const output = 'test-results/immersive-sound';
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-webgl'] });
const records = [], errors = [];
const worldStub = `
export async function createWorld(options) {
  const state = { current: options.data.islands[0].articleId, stage: 'arrival' };
  return {
    focus(id) { state.current = id; options.onTransitionStage?.('arrival', { question: '已抵達文章島。' }); },
    getState() { return state; },
    setPopulation() {}, setReducedMotion() {}, setSeason() {}, setMode() {},
    setEncounter() {}, setSpeech() {}, setRecommendations() {}, setActive() {},
    setArrivalEnabled() {}, playArrival() {}, skipArrival() {}, cancelArrival() {},
    preview() {}, applyInteraction() {}, setSound() {}, dispose() {},
  };
}`;

try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.route('**/immersive/world.js*', route => route.fulfill({ contentType: 'text/javascript', body: worldStub }));
  await page.addInitScript(() => {
    window.__audio = { contexts: 0, nodes: [] };
    class FakeNode {
      constructor(kind) { this.kind = kind; this.disconnectCount = 0; window.__audio.nodes.push(this); }
      connect() {}
      disconnect() { this.disconnectCount++; }
    }
    class FakeGain extends FakeNode {
      constructor() { super('gain'); this.gain = { value: 0 }; }
    }
    class FakeOscillator extends FakeNode {
      constructor() { super('oscillator'); this.type = 'sine'; this.frequency = { value: 0 }; this.started = false; this.stopped = false; }
      start() { this.started = true; }
      stop() { this.stopped = true; }
    }
    class FakeAudioContext {
      constructor() { window.__audio.contexts++; this.destination = {}; this.state = 'suspended'; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createGain() { return new FakeGain(); }
      createOscillator() { return new FakeOscillator(); }
    }
    window.AudioContext = FakeAudioContext;
  });
  await page.goto(`${origin}/immersive/index.html`);
  await page.waitForFunction(() => window.immersive?.world);
  const initial = await page.evaluate(() => ({ contexts: window.__audio.contexts, nodes: window.__audio.nodes.length }));
  assert.deepEqual(initial, { contexts: 0, nodes: 0 });

  await page.locator('#settings-toggle').click();
  await page.locator('#sound').check();
  await page.waitForFunction(() => window.__audio.nodes.length > 0);
  const profiles = {};
  profiles.I01 = await page.evaluate(() => window.__audio.nodes.filter(node => node.kind === 'oscillator').map(node => ({ type: node.type, frequency: node.frequency.value })));
  for (const islandId of ['P01', 'M01', 'A01']) {
    await page.locator('#map-toggle').click();
    await page.locator('#article-list button').filter({ hasText: islandId }).click();
    profiles[islandId] = await page.evaluate(() => window.__audio.nodes.filter(node => node.kind === 'oscillator' && node.started && !node.stopped).map(node => ({ type: node.type, frequency: node.frequency.value })));
  }
  assert.equal(new Set(Object.values(profiles).map(profile => profile.map(item => `${item.type}:${item.frequency}`).join(','))).size, 4);

  const beforeMute = await page.evaluate(() => ({
    oscillators: window.__audio.nodes.filter(node => node.kind === 'oscillator').map(node => ({ stopped: node.stopped, disconnected: node.disconnectCount > 0 })),
    gains: window.__audio.nodes.filter(node => node.kind === 'gain').map(node => ({ disconnected: node.disconnectCount > 0 })),
  }));
  assert.ok(beforeMute.oscillators.slice(0, -3).every(node => node.stopped && node.disconnected));
  await page.locator('#settings-toggle').click();
  await page.locator('#sound').uncheck();
  const muted = await page.evaluate(() => ({
    oscillators: window.__audio.nodes.filter(node => node.kind === 'oscillator').map(node => ({ stopped: node.stopped, disconnected: node.disconnectCount > 0 })),
    gains: window.__audio.nodes.filter(node => node.kind === 'gain').map(node => ({ disconnected: node.disconnectCount > 0 })),
  }));
  assert.ok(muted.oscillators.every(node => node.stopped && node.disconnected));
  assert.ok(muted.gains.every(node => node.disconnected));
  assert.equal(errors.length, 0, errors.join('\\n'));
  records.push({ initial, profiles, beforeMute, muted, errors, audio: 'mocked AudioContext on real app DOM' });
  await writeFile(`${output}/results.json`, JSON.stringify(records, null, 2));
  await page.close();

  const failed = await browser.newPage({ viewport: { width: 800, height: 600 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  failed.on('pageerror', error => errors.push(error.message));
  await failed.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await failed.route('**/immersive/world.js*', route => route.fulfill({ contentType: 'text/javascript', body: worldStub }));
  await failed.addInitScript(() => { window.AudioContext = class { constructor() { throw new Error('blocked'); } }; });
  await failed.goto(`${origin}/immersive/index.html`);
  await failed.waitForFunction(() => window.immersive?.world);
  await failed.locator('#settings-toggle').click();
  await failed.locator('#sound').click();
  await failed.waitForFunction(() => !document.querySelector('#sound').checked);
  assert.equal(await failed.locator('#sound-status').isVisible(), true);
  assert.match(await failed.locator('#sound-status').innerText(), /未能啟用音效/);
  await failed.locator('#read').click();
  assert.ok((await failed.locator('#reader-title').innerText()).length > 0);
  records.push({ audioContextFailure: await failed.locator('#status').innerText(), readingAvailable: true, errors });
  await writeFile(`${output}/results.json`, JSON.stringify(records, null, 2));
  console.log(JSON.stringify({ records, output }));
  await failed.close();
} finally {
  await browser.close();
  server.httpServer.closeAllConnections?.();
  await server.close();
}
