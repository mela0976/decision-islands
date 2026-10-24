import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const outputDir = 'test-results/immersive-scenario-choice';
await mkdir(outputDir, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const errors = [];
const matrix = [];
const screenshots = [];

function hash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function clean(value) { return value.replace(/[^a-z0-9-]/gi, '-').toLowerCase(); }

async function chooseSelect(page, index, value) {
  await page.locator('#game-controls select').nth(index).selectOption(value);
}

async function finishGenericChoice(page, kind) {
  const controls = page.locator('#game-controls');
  if (kind === 'sourceverification') {
    await controls.getByRole('button').first().click();
    await controls.getByRole('button', { name: '先當成已確認', exact: true }).click();
  } else if (kind === 'purchase') {
    await chooseSelect(page, 1, 'price');
    await chooseSelect(page, 2, 'low');
    await controls.getByRole('button', { name: '依照我的條件比較', exact: true }).click();
  } else if (kind === 'attention') {
    await controls.getByRole('button', { name: '路過看一眼', exact: true }).click();
    await controls.getByRole('button', { name: '轉身後回想', exact: true }).click();
    await controls.getByRole('button', { name: '先問人，再問 AI', exact: true }).click();
  } else if (kind === 'memory') {
    await controls.getByRole('button', { name: /翻看舊票根/ }).click();
    await controls.getByRole('button', { name: '把這段回憶留在廣場', exact: true }).click();
  } else if (kind === 'persona') {
    await chooseSelect(page, 1, 'commute');
    await chooseSelect(page, 2, 'narrow');
    await controls.getByRole('button', { name: '查看條件與推論邊界', exact: true }).click();
  } else if (kind === 'judgment') {
    for (const [index, value] of ['data', 'estimate', 'inference', 'unknown'].entries()) await chooseSelect(page, index + 1, value);
    await controls.getByRole('button', { name: '把資訊放上證據桌', exact: true }).click();
  } else if (kind === 'journey') {
    await chooseSelect(page, 1, 'compare');
    await chooseSelect(page, 2, 'human');
    await controls.getByRole('button', { name: '修復這一段旅程', exact: true }).click();
  } else if (kind === 'delegation') {
    await chooseSelect(page, 1, 'draft');
    await chooseSelect(page, 2, 'confirm');
    await controls.getByRole('button', { name: '啟動協作', exact: true }).click();
  } else {
    throw new Error(`Unknown interaction kind ${kind}`);
  }
  await page.locator('#game-after:not([hidden])').waitFor();
}

async function openChoice(page, scene, choiceId) {
  await page.evaluate(({ articleId }) => {
    window.immersive.visit(articleId, null, false);
    window.immersive.openGame();
  }, { articleId: scene.articleId });
  await page.locator('#game[open]').waitFor();
  await page.locator('#scene-choice').selectOption(choiceId);
  await finishGenericChoice(page, scene.interactionType);
  await page.waitForFunction(({ articleId, choiceId }) => {
    const world = window.immersive?.world;
    const interaction = world?.getState().interaction;
    return window.immersive?.world && window.immersive.data.scenes.some(scene => scene.articleId === articleId)
      && interaction?.scenarioChoice === choiceId && interaction.effectId;
  }, { articleId: scene.articleId, choiceId });
  await page.waitForTimeout(80);
}

async function readEffectState(page) {
  return page.evaluate(() => {
    const state = window.immersive.world.getState();
    const interaction = state.interaction;
    return {
      current: state.current,
      interaction,
      actorPositions: state.characters.map(({ id, position, expression }) => ({ id, position, expression })),
      speech: state.speech,
      impact: document.querySelector('#game-impact')?.textContent,
      resultVisible: !document.querySelector('#game-after')?.hidden,
    };
  });
}

async function screenshotRecord(page, label, recordFullPage) {
  const canvasPath = `${outputDir}/${label}-canvas.png`;
  const pagePath = `${outputDir}/${label}-page.png`;
  const canvas = await page.locator('#world').screenshot({ path: canvasPath });
  if (recordFullPage) await page.screenshot({ path: pagePath, fullPage: true });
  screenshots.push({ label, canvasPath, ...(recordFullPage ? { pagePath } : {}), sha256: hash(canvas), viewport: page.viewportSize() });
  return hash(canvas);
}

async function startPage(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${viewport.width}x${viewport.height}: ${error.message}`));
  await page.goto(`${origin}/immersive/index.html?acceptance=scenario-choice`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.immersive?.world && window.immersive?.data?.scenes?.length === 22, { timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  if (await page.locator('#explore-tip').isVisible()) await page.locator('#hide-explore-tip').click();
  return { context, page };
}

try {
  const { context, page } = await startPage({ width: 1280, height: 800 });
  const allScenes = await page.evaluate(() => window.immersive.data.scenes.map(scene => ({
    articleId: scene.articleId,
    title: window.immersive.data.articles.find(article => article.id === scene.articleId)?.title,
    islandId: scene.islandId,
    interactionType: scene.interactionType,
    protagonistId: scene.protagonistId,
    options: scene.interaction.control.options.map(({ id, label }) => ({ id, label })),
    outcomes: scene.interaction.outcomes.map(outcome => ({ choiceId: outcome.choiceId, effect: outcome.visualEffect })),
  })));
  assert.equal(allScenes.length, 22);
  assert.equal(allScenes.reduce((count, scene) => count + scene.options.length, 0), 68);
  const requestedIslands = process.env.SCENARIO_CHOICE_ISLANDS?.split(',').filter(Boolean);
  const scenes = requestedIslands ? allScenes.filter(scene => requestedIslands.includes(scene.islandId)) : allScenes;
  if (requestedIslands) assert.deepEqual(scenes.map(scene => scene.islandId).sort(), [...requestedIslands].sort());

  for (const scene of scenes) {
    const optionResults = [];
    for (const option of scene.options) {
      await openChoice(page, scene, option.id);
      const state = await readEffectState(page);
      const expected = scene.outcomes.find(outcome => outcome.choiceId === option.id).effect;
      assert.equal(state.current, scene.articleId, `${scene.islandId}/${option.id} completed on its island`);
      assert.equal(state.interaction.scenarioChoice, option.id, `${scene.islandId}/${option.id} survives world readback`);
      assert.equal(state.interaction.effectId, expected.id, `${scene.islandId}/${option.id} resolves its own effect`);
      assert.equal(state.interaction.propId, expected.propId);
      assert.equal(state.interaction.action, expected.action);
      assert.equal(state.interaction.actorId, expected.actorId);
      assert.ok(state.interaction.scenarioObjects.length > 0, `${scene.islandId}/${option.id} creates actual 3D props`);
      assert.equal(state.speech, expected.reactionText, `${scene.islandId}/${option.id} gives its actor the matching short reaction`);
      assert.equal(state.impact, expected.reactionText, `${scene.islandId}/${option.id} shows its matching mobile summary`);
      if (scene.islandId === 'M05') {
        const taskCopy = await page.locator('#game-controls').innerText();
        assert.doesNotMatch(taskCopy, /8 人到場|12 張椅子/, 'M05 uses its organization scene in the generic classification task');
      }
      const propSignature = JSON.stringify(state.interaction.scenarioObjects.map(({ propId, action, geometry, position, rotation, scale }) => ({ propId, action, geometry, position, rotation, scale })));
      const shortChoice = `${scene.islandId}-${option.id}-desktop`;
      const imageHash = await screenshotRecord(page, shortChoice, ['P06', 'M05', 'A01'].includes(scene.islandId));
      optionResults.push({
        choiceId: option.id,
        optionLabel: option.label,
        effectId: expected.id,
        propId: expected.propId,
        action: expected.action,
        actorId: expected.actorId,
        reactionText: expected.reactionText,
        propCount: state.interaction.scenarioObjects.length,
        propSignature,
        imageHash,
      });
      await page.locator('#game button[aria-label="關閉情境"]').click();
    }
    assert.equal(new Set(optionResults.map(result => result.propSignature)).size, scene.options.length, `${scene.islandId} gives every option a different actual prop/action pose`);
    assert.equal(new Set(optionResults.map(result => result.imageHash)).size, scene.options.length, `${scene.islandId} renders a different 3D image for every option`);
    matrix.push({ islandId: scene.islandId, articleId: scene.articleId, interactionType: scene.interactionType, options: optionResults });
  }

  const p06 = scenes.find(scene => scene.islandId === 'P06');
  const p06Choice = 'cheer';
  await openChoice(page, p06, p06Choice);
  const cheerAfter = await readEffectState(page);
  const cheerSignature = JSON.stringify(cheerAfter.interaction.scenarioObjects);
  await page.locator('#compare').click();
  const before = await readEffectState(page);
  assert.equal(before.interaction.before, true);
  assert.equal(before.interaction.scenarioChoice, p06Choice);
  assert.equal(before.interaction.effectId, 'P06-cheer');
  assert.deepEqual(before.interaction.scenarioObjects, []);
  assert.equal(before.interaction.baselineRestored, true, 'compare restores the uncompleted P06 scene and actor poses');
  await page.locator('#compare').click();
  const after = await readEffectState(page);
  assert.equal(after.interaction.before, false);
  assert.equal(JSON.stringify(after.interaction.scenarioObjects), cheerSignature, 'compare restores the same selected 3D objects');

  await page.locator('#replay').click();
  await page.locator('#game-controls').waitFor();
  const replayState = await page.evaluate(() => ({
    choice: document.querySelector('#scene-choice')?.value,
    worldChoice: window.immersive.world.getState().interaction.scenarioChoice,
    worldEffectId: window.immersive.world.getState().interaction.effectId,
    controlsVisible: !document.querySelector('#game-controls').hidden,
  }));
  assert.equal(replayState.choice, p06.options[0].id, 'replay starts with the authored default scenario choice');
  assert.equal(replayState.worldChoice, p06Choice, 'the completed impact remains recorded while replay shows its before state');
  assert.equal(replayState.worldEffectId, 'P06-cheer');
  assert.equal(replayState.controlsVisible, true);
  await page.locator('#scene-choice').selectOption(p06Choice);
  await finishGenericChoice(page, p06.interactionType);
  await page.locator('#game button[aria-label="關閉情境"]').click();
  await page.evaluate(({ fromId, toId }) => {
    window.immersive.visit(fromId, null, false);
    window.immersive.visit(toId, null, false);
  }, { fromId: allScenes.find(scene => scene.islandId === 'P07').articleId, toId: p06.articleId });
  const returned = await readEffectState(page);
  assert.equal(returned.interaction.scenarioChoice, p06Choice, 'leaving and returning retains the completed scenario choice');
  assert.equal(returned.interaction.effectId, 'P06-cheer');
  assert.equal(JSON.stringify(returned.interaction.scenarioObjects), cheerSignature, 'returning reconstructs the same actual props');
  assert.equal(returned.speech, p06.outcomes.find(outcome => outcome.choiceId === p06Choice).effect.reactionText);
  await page.locator('#game button[aria-label="關閉情境"]').click({ timeout: 1000 }).catch(() => undefined);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const mobileMainIslands = ['P06', 'M05', 'A01'];
  const mobile = [];
  for (const islandId of mobileMainIslands) {
    const scene = scenes.find(item => item.islandId === islandId);
    const images = [];
    for (const option of scene.options) {
      await openChoice(page, scene, option.id);
      const state = await readEffectState(page);
      const expected = scene.outcomes.find(outcome => outcome.choiceId === option.id).effect;
      assert.equal(state.interaction.scenarioChoice, option.id);
      assert.equal(state.speech, expected.reactionText);
      const box = await page.locator('#game').boundingBox();
      assert.ok(box.height <= 844 * .48 + 3, `${islandId}/${option.id} result sheet stays within 48vh, got ${box.height}px`);
      const label = `${islandId}-${option.id}-mobile`;
      const imageHash = await screenshotRecord(page, label, true);
      images.push({ choiceId: option.id, effectId: expected.id, reactionText: expected.reactionText, imageHash, sheetHeight: box.height });
      await page.locator('#game button[aria-label="關閉情境"]').click();
    }
    assert.equal(new Set(images.map(image => image.imageHash)).size, scene.options.length, `${islandId} mobile renders every scenario differently`);
    mobile.push({ islandId, articleId: scene.articleId, options: images });
  }
  await context.close();

  const lateContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const latePage = await lateContext.newPage();
  latePage.on('pageerror', error => errors.push(`late world: ${error.message}`));
  const lateModuleDelayMs = 3500;
  let delayedRequests = 0;
  await latePage.route(/(?:\/immersive\/world\.js|\/assets\/world-[^/]+\.js)(?:\?.*)?$/, async route => {
    delayedRequests++;
    await new Promise(resolve => setTimeout(resolve, lateModuleDelayMs));
    await route.continue();
  });
  await latePage.goto(`${origin}/immersive/index.html?acceptance=late-scenario-choice`, { waitUntil: 'domcontentloaded' });
  await latePage.locator('#interact:enabled').waitFor();
  const m05 = scenes.find(scene => scene.islandId === 'M05');
  await latePage.locator('#map-toggle').click();
  await latePage.locator('#search').fill(m05.title);
  await latePage.locator('#article-list').getByRole('button', { name: new RegExp(m05.islandId) }).click();
  await latePage.locator('#interact').click();
  await latePage.locator('#scene-choice').selectOption('fear');
  const genericM05 = latePage.locator('#game-controls');
  const taskCopy = await genericM05.innerText();
  assert.doesNotMatch(taskCopy, /8 人到場|12 張椅子/);
  for (const [index, value] of ['data', 'estimate', 'inference', 'unknown'].entries()) await chooseSelect(latePage, index + 1, value);
  await genericM05.getByRole('button', { name: '把資訊放上證據桌', exact: true }).click();
  await latePage.locator('#game-after:not([hidden])').waitFor();
  assert.equal(await latePage.evaluate(() => Boolean(window.immersive?.world)), false, 'M05 result finishes before the delayed world module');
  await latePage.waitForFunction(() => {
    const interaction = window.immersive?.world?.getState().interaction;
    return interaction?.scenarioChoice === 'fear' && interaction.effectId === 'M05-fear' && interaction.scenarioObjects?.length > 0;
  }, { timeout: 15000 });
  const lateState = await latePage.evaluate(() => ({
    interaction: window.immersive.world.getState().interaction,
    speech: window.immersive.world.getState().speech,
    impact: document.querySelector('#game-impact').textContent,
  }));
  assert.equal(lateState.speech, '顧慮卡從水面下翻出，芬姐停下聆聽。');
  assert.equal(lateState.impact, lateState.speech);
  assert.equal(delayedRequests, 1);
  await lateContext.close();

  assert.deepEqual(errors, [], errors.join('\n'));
  const result = {
    browser: 'Chromium WebGL / SwiftShader',
    reducedMotion: true,
    desktopViewport: { width: 1280, height: 800 },
    mobileViewport: { width: 390, height: 844 },
    islandCount: matrix.length,
    scenarioChoiceCount: matrix.reduce((count, island) => count + island.options.length, 0),
    genericInteractionTypes: [...new Set(matrix.map(island => island.interactionType))],
    mobileMainIslands: mobile.map(island => island.islandId),
    compareReplayReturn: { beforeRestored: true, replayControlsOpened: true, returnedScenarioChoice: p06Choice, returnedEffectId: 'P06-cheer' },
    lateWorld: { delayMs: lateModuleDelayMs, requests: delayedRequests, scenarioChoice: 'fear', effectId: lateState.interaction.effectId, props: lateState.interaction.scenarioObjects.length },
    screenshots,
    errors,
    matrix,
    mobile,
  };
  await writeFile(`${outputDir}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ islandCount: result.islandCount, scenarioChoiceCount: result.scenarioChoiceCount, genericInteractionTypes: result.genericInteractionTypes, mobileMainIslands: result.mobileMainIslands, compareReplayReturn: result.compareReplayReturn, lateWorld: result.lateWorld, errors }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
