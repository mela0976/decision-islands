import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const records = [], errors = [];
try {
  for (const kind of ['first-intro', 'returning', 'early-reader']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(kind => {
      if (kind !== 'first-intro') localStorage.setItem('decision-immersive-progress-v1', JSON.stringify({ version: 1, introSeen: true }));
      localStorage.setItem('dentsu-decision-2026-explore-tip', 'dismissed');
      window.__arrivalCaptions = [];
      new MutationObserver(() => {
        const dialogue = document.querySelector('#dialogue'), intro = document.querySelector('#intro');
        if (dialogue) window.__arrivalCaptions.push({ time: performance.now(), text: dialogue.textContent, introHidden: Boolean(intro?.hidden) });
      }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    }, kind);
    if (kind === 'early-reader') await page.route('**/immersive/world.js', async route => { await new Promise(resolve => setTimeout(resolve, 4500)); await route.continue(); });
    await page.goto(`${origin}/immersive/index.html`);
    if (kind === 'early-reader') { await page.locator('#read:enabled').click(); assert.equal(await page.locator('#reader').evaluate(dialog => dialog.open), true); }
    await page.waitForFunction(() => window.immersive?.world, { timeout: 25000 });
    const state = await page.evaluate(() => {
      const api = window.immersive, script = api.data.scenes.find(scene => scene.articleId === api.world.getState().current).arrivalEvent;
      return { event: api.world.getState().arrivalEvent, cause: script.beats[0].caption.text, observations: window.__arrivalCaptions.filter(item => item.text.includes(script.beats[0].caption.text)), readerOpen: document.querySelector('#reader').open, render: api.world.getRenderState() };
    });
    if (kind === 'early-reader') { assert.equal(state.event, null); assert.equal(state.render.active, false); assert.equal(state.readerOpen, true); }
    else {
      assert.equal(state.event.phase, 'cause'); assert.ok(state.event.elapsed < .8, `${kind} visible cause starts with fresh clock ${state.event.elapsed}`);
      assert.ok(state.observations.length > 0); assert.ok(state.observations.every(item => item.introHidden), `${kind} cause is never spent beneath intro`);
      if (kind === 'first-intro') assert.ok(state.observations[0].time > 7500, 'real animated intro ran before arrival');
    }
    records.push({ kind, ...state }); await page.close();
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  await mkdir('test-results/immersive-arrival-startup', { recursive: true });
  await writeFile('test-results/immersive-arrival-startup/results.json', JSON.stringify({ records, errors }, null, 2));
  console.log(JSON.stringify({ cases: records.length, errors }));
} finally { await browser.close(); server.httpServer.closeAllConnections?.(); await server.close(); }
