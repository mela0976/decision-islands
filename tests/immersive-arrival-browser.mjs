import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, preview } from 'vite';
import { chromium } from '@playwright/test';
const output = `test-results/immersive-arrival${process.env.BUILT ? '-built' : ''}`;
await mkdir(output, { recursive: true });
const server = process.env.BUILT ? await preview({ preview: { host: '127.0.0.1', port: 0 } }) : await createServer({ server: { host: '127.0.0.1', port: 0 } });
if (!process.env.BUILT) await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const records = [], errors = [], representatives = ['I01', 'P06', 'M05', 'A01', 'A06'];
try {
  for (const viewport of (process.env.BUILT ? [{ width: 1280, height: 800 }] : [{ width: 1280, height: 800 }, { width: 390, height: 844 }])) {
    const page = await browser.newPage({ viewport, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('dentsu-decision-2026-explore-tip', 'dismissed'));
    await page.goto(`${origin}/immersive/index.html`);
    if (await page.locator('#skip-intro').isVisible()) await page.locator('#skip-intro').click();
    await page.waitForFunction(() => window.immersive?.world);
    const islands = await page.evaluate(() => window.immersive.data.islands.map(({ id, articleId }) => ({ id, articleId })));
    for (const island of islands.filter(({ id }) => process.env.ARRIVAL_IDS ? process.env.ARRIVAL_IDS.split(',').includes(id) : process.env.BUILT ? id === 'A06' : viewport.width >= 700 || representatives.includes(id))) {
      await page.evaluate(id => { window.immersive.visit(id, null, false); window.immersive.world.playArrival({ source: 'bell' }); }, island.articleId);
      const samples = [];
      for (const phase of ['cause', 'action', 'reaction']) {
        await page.waitForFunction(phase => {
          const api = window.immersive, state = api.world.getState().arrivalEvent;
          if (state?.phase !== phase) return false;
          const script = api.data.scenes.find(scene => scene.articleId === state.articleId).arrivalEvent;
          const index = script.beats.findIndex(beat => beat.id === phase);
          const start = script.beats.slice(0, index).reduce((sum, beat) => sum + beat.duration, 0);
          return state.elapsed >= start + script.beats[index].duration * .55;
        }, phase, { timeout: 20000 });
        await page.evaluate(() => window.immersive.world.setActive(false));
        const sample = await page.evaluate(() => window.immersive.world.getState().arrivalEvent);
        samples.push(sample);
        assert.ok(sample.props.length > 0, `${island.id} ${phase} actual props`);
        assert.ok(sample.participants.length > 0);
        for (const prop of sample.props.filter(prop => prop.owner)) assert.ok(prop.contactDistance < .01, `${island.id} ${phase} palm contact`);
        if (representatives.includes(island.id)) await page.locator('#world').screenshot({ path: `${output}/${viewport.width}-${island.id}-${phase}.png` });
        await page.evaluate(() => window.immersive.world.setActive(true));
      }
      await page.waitForFunction(() => window.immersive.world.getState().arrivalEvent?.complete, { timeout: 20000 });
      const final = await page.evaluate(() => window.immersive.world.getState().arrivalEvent);
      assert.deepEqual(final.history, ['cause', 'action', 'reaction']);
      assert.ok(samples.some((sample, index) => index && JSON.stringify(sample.props.map(p => [p.position, p.rotation, p.owner])) !== JSON.stringify(samples[0].props.map(p => [p.position, p.rotation, p.owner]))) || samples.some((sample, index) => index && JSON.stringify(sample.participants) !== JSON.stringify(samples[0].participants)) || final.crowdCount >= 3, `${island.id} observable staged motion`);
      records.push({ viewport, island: island.id, samples, final });
      console.log(`${viewport.width} ${island.id} cause/action/reaction verified`);
    }
    await page.evaluate(() => window.immersive.world.playArrival({ source: 'bell' }));
    await page.locator('#read').click();
    const paused = await page.evaluate(() => window.immersive.world.getState().arrivalEvent.elapsed);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.immersive.world.getState().arrivalEvent.elapsed), paused);
    await page.locator('#reader form button').click();
    await page.waitForTimeout(100);
    assert.ok((await page.evaluate(() => window.immersive.world.getState().arrivalEvent.elapsed)) < paused + .4);
    await page.locator('#skip-arrival').click();
    assert.equal(await page.evaluate(() => window.immersive.world.getState().arrivalEvent.skipped), true);
    await page.evaluate(() => { window.immersive.world.playArrival({ source: 'bell' }); window.immersive.openGame(); });
    assert.equal(await page.evaluate(() => window.immersive.world.getState().arrivalEvent), null);
    await page.locator('#game form button').click();
    await page.evaluate(() => { window.immersive.world.setReducedMotion(true); window.immersive.world.playArrival({ source: 'bell' }); });
    assert.equal(await page.evaluate(() => window.immersive.world.getState().arrivalEvent.complete), true);
    await page.evaluate(() => { const api = window.immersive; api.world.setReducedMotion(false); api.world.playArrival({ source: 'bell' }); api.visit(api.data.islands[1].articleId, null, true); });
    assert.equal(await page.evaluate(() => window.immersive.world.getState().arrivalEvent), null);
    await page.close();
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(`${output}/results.json`, JSON.stringify({ records, errors }, null, 2));
  console.log(JSON.stringify({ cases: records.length, errors, output }));
} finally { await browser.close(); server.httpServer.closeAllConnections?.(); await server.close(); }
