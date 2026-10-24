import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const output = 'test-results/immersive-character-contact';
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const records = [], errors = [];
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/immersive/index.html`);
    await page.waitForFunction(() => window.immersive?.world);
    if (await page.locator('#explore-tip').isVisible()) await page.locator('#hide-explore-tip').click();
    for (const [canonical, choice, kind] of [['P05', 'value', 'purchase'], ['P06', 'cheer', 'memory'], ['A01', 'support', 'journey']]) {
      await page.evaluate(({ canonical, choice }) => {
        const scene = window.immersive.data.scenes.find(scene => scene.islandId === canonical || scene.id === canonical);
        const island = window.immersive.data.islands.find(island => island.id === canonical);
        window.immersive.visit(scene?.articleId || island.articleId, null, false);
        window.immersive.openGame();
      }, { canonical, choice });
      await page.locator('#scene-choice').selectOption(choice);
      const controls = page.locator('#game-controls');
      if (kind === 'purchase') {
        await controls.locator('select').nth(1).selectOption('price');
        await controls.locator('select').nth(2).selectOption('low');
        await controls.getByRole('button', { name: '依照我的條件比較', exact: true }).click();
      } else if (kind === 'memory') {
        await controls.getByRole('button', { name: /翻看舊票根/ }).click();
        await controls.getByRole('button', { name: '把這段回憶留在廣場', exact: true }).click();
      } else {
        await controls.locator('select').nth(1).selectOption('compare');
        await controls.locator('select').nth(2).selectOption('human');
        await controls.getByRole('button', { name: '修復這一段旅程', exact: true }).click();
      }
      await page.waitForFunction(() => window.immersive.world.getCharacterContactState()?.phase === 'approach');
      const start = await page.evaluate(() => window.immersive.world.getCharacterContactState());
      await page.locator('#world').screenshot({ path: `${output}/${viewport.width}-${canonical}-start.png` });
      await page.waitForFunction(() => window.immersive.world.getCharacterContactState()?.phase === 'hold');
      await page.evaluate(() => window.immersive.world.setActive(false));
      const contact = await page.evaluate(() => window.immersive.world.getCharacterContactState());
      assert.equal(contact.ownerCount, 1);
      for (const participant of contact.mode === 'exchange' ? contact.participants : contact.participants.slice(0, 1)) {
        assert(participant.gripDistance < participant.headWidth / 4, `${canonical} hand grip ${participant.gripDistance}`);
        assert(participant.gazeAlignment > .98, `${canonical} gaze ${participant.gazeAlignment}`);
      }
      assert(distance(start.propPosition, contact.propPosition) > .4);
      await page.locator('#world').screenshot({ path: `${output}/${viewport.width}-${canonical}-contact.png` });
      await page.waitForTimeout(250);
      const paused = await page.evaluate(() => window.immersive.world.getCharacterContactState());
      assert.equal(paused.elapsed, contact.elapsed);
      await page.evaluate(() => window.immersive.world.setActive(true));
      const samples = [];
      await page.waitForFunction(() => window.immersive.world.getCharacterContactState()?.elapsed >= 2.5);
      for (let i = 0; i < 7; i++) {
        samples.push(await page.evaluate(() => window.immersive.world.getCharacterContactState()));
        await page.waitForTimeout(40);
      }
      for (let i = 1; i < samples.length; i++) {
        assert.equal(samples[i].ownerCount, 1);
        assert(distance(samples[i - 1].propPosition, samples[i].propPosition) < .2, `${canonical} continuous transfer`);
      }
      await page.waitForFunction(() => window.immersive.world.getCharacterContactState()?.complete);
      const final = await page.evaluate(() => window.immersive.world.getCharacterContactState());
      assert.equal(final.owner, null);
      assert(final.supported);
      assert(distance(final.propPosition, final.supportPosition) < 1e-5);
      await page.locator('#world').screenshot({ path: `${output}/${viewport.width}-${canonical}-reaction.png` });
      await page.waitForTimeout(150);
      assert.deepEqual((await page.evaluate(() => window.immersive.world.getCharacterContactState())).propPosition, final.propPosition);
      records.push({ viewport, canonical, start, contact, final, transferSamples: samples });
      await page.getByRole('button', { name: '關閉情境', exact: true }).click();
    }
    await page.evaluate(() => window.immersive.world.focus('P06', { animate: false }));
    assert.equal(await page.evaluate(() => window.immersive.world.getCharacterContactState()?.articleId === window.immersive.world.getState().current), true);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ passed: true, records, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, cases: records.length, output }));
} finally { await browser.close(); await server.close(); }
