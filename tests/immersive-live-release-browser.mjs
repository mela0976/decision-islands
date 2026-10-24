import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const liveRoot = 'https://mela0976.github.io/decision-islands/?campaign=live-acceptance#article';
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const startedAt = Date.now();
  await page.goto(liveRoot, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => location.pathname === '/decision-islands/immersive/', { timeout: 30000 });
  await page.waitForFunction(() => window.immersive?.world, { timeout: 45000 });
  assert.equal(new URL(page.url()).search, '?campaign=live-acceptance');
  assert.equal(new URL(page.url()).hash, '#article');
  const islandCount = await page.evaluate(() => window.immersive.data.islands.length);
  assert.equal(islandCount, 22);
  const workerScopes = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(registration => new URL(registration.scope).pathname));
  assert.ok(workerScopes.includes('/decision-islands/'));
  assert.ok(workerScopes.includes('/decision-islands/immersive/'));

  await page.locator('#read').click();
  await page.locator('[data-depth="full"]').click();
  const articleCharacters = (await page.locator('#reading-content').innerText()).length;
  assert.ok(articleCharacters > 1000);
  await page.locator('dialog#reader button.close').click();
  await page.locator('#interact').click();
  await page.waitForFunction(() => document.querySelector('#game').open);
  const choices = await page.locator('#game-controls button').allInnerTexts();
  assert.ok(choices.length > 0);
  await page.locator('#game-controls button').first().click();
  await page.waitForFunction(() => document.querySelector('#game-impact').innerText.trim().length > 0);
  const result = (await page.locator('#game-impact').innerText()).trim();
  const effect = await page.evaluate(() => {
    const state = window.immersive.world.getState();
    const currentScene = window.immersive.data.scenes.find(scene => scene.articleId === state.current);
    const outcome = currentScene?.interaction.outcomes.find(item => item.choiceId === state.interaction?.scenarioChoice);
    return { expected: outcome?.visualEffect.reactionText, effectId: state.interaction?.effectId, objects: state.interaction?.scenarioObjects?.length, characterEvent: state.characterEvent };
  });
  assert.equal(result, effect.expected);
  assert.ok(effect.effectId && effect.objects > 0);
  assert.equal(effect.characterEvent?.effectId, effect.effectId);
  assert.equal(effect.characterEvent.complete, true);
  assert.equal(effect.characterEvent.supported, true);
  const editorial = await page.evaluate(() => ({
    motifs: window.immersive.world.getState().editorialMotifs,
    textureCount: window.immersive.world.getRenderState().editorialTextureCount,
  }));
  assert.ok(editorial.motifs.some(motif => motif.motifId === 'proposal'));
  assert.ok(editorial.textureCount > 0);
  assert.equal(errors.length, 0, errors.join('\n'));

  const evidence = {
    liveRoot,
    finalUrl: page.url(),
    elapsedMs: Date.now() - startedAt,
    islandCount,
    workerScopes,
    articleCharacters,
    interactionChoices: choices,
    interactionResult: result,
    scenarioEffect: effect,
    editorial,
    browserErrors: errors,
    deploymentCommit: process.env.DEPLOYMENT_COMMIT || 'not-supplied',
  };
  await mkdir('test-results/immersive-live-release', { recursive: true });
  await writeFile('test-results/immersive-live-release/results.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
