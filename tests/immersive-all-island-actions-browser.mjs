import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?acceptance=all-islands`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.immersive?.world, { timeout: 30000 });
  const articles = await page.evaluate(() => window.immersive.data.articles.map(article => ({ id: article.id, title: article.title })));
  assert.equal(articles.length, 22);
  const interactions = [];
  for (const article of articles) {
    await page.evaluate(id => { window.immersive.visit(id, null, false); window.immersive.openGame(); }, article.id);
    await page.waitForFunction(() => document.querySelector('#game').open);
    let attempts = 0;
    while (!(await page.locator('#game-after').isVisible()) && attempts < 8) {
      const buttons = page.locator('#game-controls button');
      const count = await buttons.count();
      assert.ok(count > 0, `${article.id}: interaction has no action button`);
      await buttons.last().click();
      attempts++;
    }
    assert.ok(await page.locator('#game-after').isVisible(), `${article.id}: mission did not complete`);
    const result = (await page.locator('#game-result').textContent()).trim();
    assert.ok(result.length > 15, `${article.id}: mission returned no explanation`);
    const state = await page.evaluate(id => {
      const data = window.immersive.data;
      const scene = data.scenes.find(item => item.articleId === id);
      return { interactionType: scene.interactionType, protagonistId: scene.protagonistId, coreDevice: scene.coreDevice, insightStampId: scene.insightStampId, stamped: window.immersive.progress.stamps.includes(scene.insightStampId) };
    }, article.id);
    assert.ok(state.stamped, `${article.id}: completion did not record its mapped insight footprint`);
    interactions.push({ articleId: article.id, title: article.title, ...state, choicesAttempted: attempts, resultCharacters: result.length });
    await page.locator('#game').evaluate(dialog => dialog.close());
  }
  assert.equal(new Set(interactions.map(item => item.interactionType)).size, 8);
  assert.equal(new Set(interactions.map(item => item.insightStampId)).size, 10);
  assert.equal(errors.length, 0, errors.join('\n'));
  const evidence = { articleCount: interactions.length, interactionTypes: [...new Set(interactions.map(item => item.interactionType))], insightFootprints: [...new Set(interactions.map(item => item.insightStampId))], errors, interactions };
  await mkdir('test-results/immersive-all-islands', { recursive: true });
  await writeFile('test-results/immersive-all-islands/results.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ articleCount: evidence.articleCount, interactionTypes: evidence.interactionTypes, insightFootprints: evidence.insightFootprints, errors }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
