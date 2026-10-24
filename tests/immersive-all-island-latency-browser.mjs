import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const outputDir = resolve(process.env.PERF_OUTPUT || 'test-results/immersive-interaction-latency');
const outputFile = join(outputDir, 'results.json');
const thresholdMs = 2000;
const timeoutMs = 10000;
const requestedBaseUrlValue = process.env.PERF_BASE_URL || null;
const requestedBaseUrl = requestedBaseUrlValue ? new URL(requestedBaseUrlValue) : null;

if (requestedBaseUrl) {
  assert.ok(['http:', 'https:'].includes(requestedBaseUrl.protocol), 'PERF_BASE_URL must use HTTP or HTTPS');
  assert.equal(requestedBaseUrl.username, '', 'PERF_BASE_URL must not include credentials');
  assert.equal(requestedBaseUrl.password, '', 'PERF_BASE_URL must not include credentials');
  assert.ok(!/[?#]/.test(requestedBaseUrlValue), 'PERF_BASE_URL must not include a query or hash');
  requestedBaseUrl.pathname = `${requestedBaseUrl.pathname.replace(/\/+$/, '')}/`;
}

const result = {
  schemaVersion: 1,
  status: 'running',
  claim: 'one warm-world pass measures visible UI responses for all 22 article islands',
  thresholdMs,
  runCount: 1,
  profile: {
    viewport: '390x844',
    deviceScaleFactor: 2,
    latencyMs: 150,
    downloadMbps: 10,
    uploadMbps: 5,
    cpuThrottle: 4,
    reducedMotion: true,
    serviceWorkers: 'blocked',
    browserContext: 'fresh, non-persistent Chromium context',
    renderer: 'Chromium ANGLE SwiftShader',
    relativeEntry: 'immersive/?latency-fixture=warm-22-island',
  },
  machine: { loadAverageAtStart: loadavg(), cpuCount: cpus().length },
  target: { kind: requestedBaseUrl ? 'PERF_BASE_URL' : 'local production preview', baseUrl: null, finalPageUrl: null },
  warmWorld: null,
  inventory: [],
  islands: [],
  errors: { page: [], console: [], http: [], requestfailed: [] },
  violations: [],
  screenshots: [],
  failure: null,
};

let server;
let browser;
let context;
let page;
let cdp;

async function saveResults() {
  result.updatedAt = new Date().toISOString();
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(result, null, 2));
}

function addStep(island, step) {
  island.steps.push(step);
  if (Number.isFinite(step.responseMs) && step.responseMs > thresholdMs) {
    result.violations.push({ articleId: island.articleId, islandId: island.islandId, step: step.name, responseMs: step.responseMs, thresholdMs });
  }
}

async function measureStep(island, name, action, ready, evidence = async () => ({})) {
  const startedAt = performance.now();
  try {
    await action();
    await ready();
    const proof = await evidence();
    const step = { name, status: 'passed', responseMs: Number((performance.now() - startedAt).toFixed(1)), ...proof };
    addStep(island, step);
    return step;
  } catch (error) {
    const step = { name, status: 'failed', responseMs: Number((performance.now() - startedAt).toFixed(1)), failure: error.stack || error.message };
    addStep(island, step);
    throw error;
  }
}

async function readWorld() {
  return page.evaluate(() => {
    const world = window.immersive?.world;
    if (!world) return null;
    const state = world.getState();
    const render = world.getRenderState();
    return {
      current: state.current,
      transitioning: state.transitioning,
      interaction: state.interaction,
      encounter: state.encounter,
      renderedFrames: render.renderedFrames,
      drawCalls: render.drawCalls,
      active: render.active,
    };
  });
}

async function readGameProof() {
  return page.evaluate(() => {
    const world = window.immersive?.world;
    const state = world?.getState();
    const render = world?.getRenderState();
    const after = document.querySelector('#game-after');
    const impact = document.querySelector('#game-impact');
    const interaction = state?.interaction;
    return {
      gameAfterVisible: Boolean(after && !after.hidden),
      impactVisible: Boolean(impact && !impact.hidden && impact.textContent.trim()),
      impactText: impact?.textContent.trim() || '',
      current: state?.current || null,
      interaction: interaction ? {
        kind: interaction.kind,
        scenarioChoice: interaction.scenarioChoice,
        effectId: interaction.effectId,
        propId: interaction.propId,
        action: interaction.action,
        layout: interaction.layout,
        outcomeObjectCount: interaction.outcomeObjectCount,
        propPosition: interaction.propPosition,
        propRotation: interaction.propRotation,
        scenarioObjects: interaction.scenarioObjects,
      } : null,
      renderedFrames: render?.renderedFrames || 0,
      drawCalls: render?.drawCalls || 0,
    };
  });
}

function summary() {
  const measuredSteps = result.islands.flatMap(island => island.steps);
  return {
    status: result.status,
    outputFile,
    runCount: result.runCount,
    measuredIslandCount: result.islands.length,
    interactionTypes: [...new Set(result.inventory.map(island => island.interactionType))],
    insightStamps: [...new Set(result.inventory.map(island => island.insightStampId))],
    stepCount: measuredSteps.length,
    violations: result.violations,
    errors: result.errors,
    failure: result.failure,
    islandIds: result.islands.map(island => island.islandId),
    slowestResponseMs: measuredSteps.length ? Math.max(...measuredSteps.map(step => step.responseMs)) : null,
  };
}

async function captureScreenshots(lastCase) {
  try {
    await page.locator('#read').click();
    await page.waitForFunction(({ title }) => {
      const reader = document.querySelector('#reader');
      return Boolean(reader?.open && document.querySelector('#reader-title')?.textContent === title);
    }, { title: lastCase.title }, { timeout: timeoutMs });
    await page.locator('[data-depth="full"]').click();
    await page.waitForFunction(({ count }) => document.querySelector('[data-depth="full"]')?.getAttribute('aria-pressed') === 'true'
      && document.querySelectorAll('#reading-content p').length === count, { count: lastCase.paragraphs.length }, { timeout: timeoutMs });
    const articleShot = join(outputDir, 'representative-full-article.png');
    await page.screenshot({ path: articleShot });
    result.screenshots.push({ path: articleShot, view: 'full article dialog', capturedAfterMeasurements: true });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#reader')?.open && window.immersive?.world?.getRenderState().active === true, null, { timeout: timeoutMs });
    const sceneShot = join(outputDir, 'representative-island-outcome.png');
    await page.locator('#world').screenshot({ path: sceneShot });
    result.screenshots.push({ path: sceneShot, view: 'island scene after interaction', capturedAfterMeasurements: true });
  } catch (error) {
    result.screenshots.push({ status: 'not captured', failure: error.message, capturedAfterMeasurements: true });
  }
}

try {
  if (!requestedBaseUrl) server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
  const baseUrl = requestedBaseUrl || new URL(`http://127.0.0.1:${server.httpServer.address().port}/`);
  result.target.baseUrl = baseUrl.href;
  const targetUrl = new URL('immersive/?latency-fixture=warm-22-island', baseUrl);
  result.target.finalPageUrl = targetUrl.href;

  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  page = await context.newPage();
  page.on('pageerror', error => result.errors.page.push(error.message));
  page.on('console', message => { if (message.type() === 'error') result.errors.console.push(message.text()); });
  page.on('requestfailed', request => result.errors.requestfailed.push({ url: request.url(), method: request.method(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', response => {
    if (response.status() >= 400) result.errors.http.push({ url: response.url(), method: response.request().method(), status: response.status() });
  });

  cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1_250_000,
    uploadThroughput: 625_000,
    connectionType: 'cellular4g',
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.immersive?.world), null, { polling: 'raf', timeout: 30000 });
  await page.locator('#interact:enabled').waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(() => window.immersive.world.getRenderState().renderedFrames > 0, null, { polling: 'raf', timeout: timeoutMs });
  let initialArrivalSkipped = false;
  if (await page.locator('#skip-arrival').isVisible()) {
    await page.locator('#skip-arrival').click();
    initialArrivalSkipped = true;
  }
  await page.waitForFunction(() => document.querySelector('#arrival-controls')?.hidden === true, null, { timeout: timeoutMs });
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      status: document.fonts.status,
      publicationFontReady: document.fonts.check('600 42px "Publication Sans TW"', '阿綺小岳映蓁芬姐'),
      loadedPublicationFaces: [...document.fonts].filter(face => /Publication Sans TW/.test(face.family) && face.status === 'loaded').length,
    };
  });
  result.warmWorld = await page.evaluate(() => {
    const world = window.immersive.world;
    const state = world.getState();
    const render = world.getRenderState();
    const canvas = document.querySelector('#world');
    return {
      fallback: document.body.classList.contains('fallback'),
      introHidden: document.querySelector('#intro')?.hidden,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      currentArticle: state.current,
      islandCount: state.renderedIslandCount,
      renderedFrames: render.renderedFrames,
      drawCalls: render.drawCalls,
      canvas: { width: canvas?.width, height: canvas?.height, clientWidth: canvas?.clientWidth, clientHeight: canvas?.clientHeight },
      active: render.active,
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
    };
  });
  result.warmWorld.initialArrivalSkipped = initialArrivalSkipped;
  result.warmWorld.fonts = fonts;
  assert.equal(result.warmWorld.fallback, false, 'the fixture must start in the drawn 3D world');
  assert.equal(result.warmWorld.islandCount, 22, 'the world must contain all 22 islands');
  assert.equal(result.warmWorld.reducedMotion, true, 'the browser must honor reduced motion');
  assert.equal(result.warmWorld.devicePixelRatio, 2, 'the browser must use DPR 2');
  assert.ok(result.warmWorld.canvas.width > 0 && result.warmWorld.canvas.height > 0, 'the world canvas must have a backing buffer');
  assert.ok(result.warmWorld.renderedFrames > 0 && result.warmWorld.drawCalls > 0, 'the world must draw before interaction timing starts');
  assert.ok(fonts.publicationFontReady && fonts.loadedPublicationFaces > 0, 'the warm world must use loaded publication fonts');
  assert.equal(result.warmWorld.serviceWorkerController, false, 'the fresh context must not be controlled by a service worker');

  const cases = await page.evaluate(() => window.immersive.data.articles.map(article => {
    const scene = window.immersive.data.scenes.find(item => item.articleId === article.id);
    const island = window.immersive.data.islands.find(item => item.articleId === article.id);
    return {
      articleId: article.id,
      islandId: scene?.islandId || island?.id || null,
      title: article.title,
      summary: article.summary,
      paragraphs: article.paragraphs || [],
      interactionType: scene?.interactionType || null,
      insightStampId: scene?.insightStampId || null,
      gameTitle: scene?.coreDevice?.label || article.title,
    };
  }));
  result.inventory = cases.map(({ articleId, islandId, title, interactionType, insightStampId, paragraphs }) => ({
    articleId,
    islandId,
    title,
    interactionType,
    insightStampId,
    paragraphCount: paragraphs.length,
    sourceTextCharacters: Array.from(paragraphs.join('')).length,
  }));
  assert.equal(cases.length, 22, 'the article catalog must list 22 islands');
  assert.equal(new Set(cases.map(item => item.articleId)).size, 22, 'article IDs must be unique');
  assert.equal(new Set(cases.map(item => item.islandId)).size, 22, 'island IDs must be unique');

  for (const item of cases) {
    const island = {
      articleId: item.articleId,
      islandId: item.islandId,
      title: item.title,
      interactionType: item.interactionType,
      insightStampId: item.insightStampId,
      status: 'running',
      steps: [],
      fullTextCharacters: null,
      sceneProof: null,
      stamped: false,
    };
    result.islands.push(island);

    try {
      assert.ok(island.islandId && island.interactionType && island.insightStampId, `${item.articleId}: island metadata is incomplete`);
      assert.equal(await page.locator('#catalog').isVisible(), false, `${item.articleId}: the catalog must be closed before opening`);

      await measureStep(island, 'catalog-open',
        () => page.locator('#map-toggle').click(),
        () => page.locator('#catalog').waitFor({ state: 'visible', timeout: timeoutMs }),
        async () => ({ visible: await page.locator('#catalog').isVisible() }));

      const directoryButton = page.locator('#article-list button').filter({ hasText: `${item.islandId} · ${item.title}` });
      assert.equal(await directoryButton.count(), 1, `${item.articleId}: the directory must expose one real button for ${item.islandId}`);
      const beforeNavigation = await readWorld();
      const navigationStep = await measureStep(island, 'directory-select',
        () => directoryButton.click(),
        () => page.waitForFunction(({ articleId, title, priorFrames }) => {
          const world = window.immersive?.world;
          const state = world?.getState();
          const render = world?.getRenderState();
          return Boolean(world && document.querySelector('#catalog')?.hidden
            && document.querySelector('#island-title')?.textContent === title
            && state?.current === articleId && !state.transitioning
            && render.renderedFrames > priorFrames && render.drawCalls > 0);
        }, { articleId: item.articleId, title: item.title, priorFrames: beforeNavigation.renderedFrames }, { polling: 'raf', timeout: timeoutMs }),
        async () => {
          const state = await readWorld();
          return { currentArticle: state.current, renderedFramesBefore: beforeNavigation.renderedFrames, renderedFramesAfter: state.renderedFrames, drawCalls: state.drawCalls };
        });
      assert.equal(navigationStep.currentArticle, item.articleId, `${item.articleId}: the selected directory entry must focus the matching island`);

      await measureStep(island, 'article-open',
        () => page.locator('#read').click(),
        () => page.waitForFunction(({ title }) => Boolean(document.querySelector('#reader')?.open
          && document.querySelector('#reader-title')?.textContent === title
          && document.querySelector('#reading-content')?.childElementCount > 0), { title: item.title }, { timeout: timeoutMs }),
        async () => ({ title: await page.locator('#reader-title').innerText(), dialogOpen: await page.locator('#reader').evaluate(dialog => dialog.open) }));

      const fullStep = await measureStep(island, 'full-article-select',
        () => page.locator('[data-depth="full"]').click(),
        () => page.waitForFunction(({ paragraphCount }) => document.querySelector('[data-depth="full"]')?.getAttribute('aria-pressed') === 'true'
          && document.querySelectorAll('#reading-content p').length === paragraphCount, { paragraphCount: item.paragraphs.length }, { timeout: timeoutMs }),
        async () => {
          const visibleParagraphs = await page.locator('#reading-content p').allTextContents();
          return {
            paragraphCount: visibleParagraphs.length,
            fullTextCharacters: Array.from(visibleParagraphs.join('')).length,
            selectedDepth: await page.locator('[data-depth="full"]').getAttribute('aria-pressed'),
          };
        });
      assert.deepEqual(await page.locator('#reading-content p').allTextContents(), item.paragraphs, `${item.articleId}: the full reading view must render every source paragraph`);
      assert.equal(fullStep.paragraphCount, item.paragraphs.length, `${item.articleId}: full article paragraph count must match the source`);
      island.fullTextCharacters = fullStep.fullTextCharacters;

      await measureStep(island, 'reader-depth-reset',
        () => page.locator('[data-depth="guide"]').click(),
        () => page.waitForFunction(({ summaryText }) => document.querySelector('[data-depth="guide"]')?.getAttribute('aria-pressed') === 'true'
          && document.querySelector('#reading-content p')?.textContent === summaryText, { summaryText: item.summary }, { timeout: timeoutMs }),
        async () => ({ selectedDepth: await page.locator('[data-depth="guide"]').getAttribute('aria-pressed') }));

      await page.waitForFunction(() => window.immersive.world.getRenderState().active === false, null, { timeout: timeoutMs });
      await measureStep(island, 'reader-close-callback',
        () => page.keyboard.press('Escape'),
        () => page.waitForFunction(() => !document.querySelector('#reader')?.open
          && window.immersive?.world?.getRenderState().active === true, null, { timeout: timeoutMs }),
        async () => ({ dialogClosed: true, worldReactivated: (await readWorld()).active }));

      await measureStep(island, 'task-open',
        () => page.locator('#interact').click(),
        () => page.waitForFunction(({ title, articleId }) => Boolean(document.querySelector('#game')?.open
          && document.querySelector('#game-title')?.textContent === title
          && window.immersive?.world?.getState().current === articleId
          && document.querySelector('#game-controls')?.childElementCount > 0), { title: item.gameTitle, articleId: item.articleId }, { timeout: timeoutMs }),
        async () => ({ dialogOpen: await page.locator('#game').evaluate(dialog => dialog.open), title: await page.locator('#game-title').innerText() }));

      let submitted = false;
      for (let attempt = 1; attempt <= 8 && !submitted; attempt++) {
        const buttons = page.locator('#game-controls button:visible');
        assert.ok(await buttons.count() > 0, `${item.articleId}: the game must expose a visible next action`);
        const actionButton = buttons.last();
        const actionLabel = (await actionButton.innerText()).trim();
        const beforeAction = await page.evaluate(() => ({
          controlsText: document.querySelector('#game-controls')?.innerText || '',
          resultText: document.querySelector('#game-result')?.textContent || '',
          renderedFrames: window.immersive.world.getRenderState().renderedFrames,
        }));
        const step = await measureStep(island, `task-action-${attempt}`,
          () => actionButton.click(),
          () => page.waitForFunction(({ articleId, controlsText, resultText, renderedFrames }) => {
            const after = document.querySelector('#game-after');
            const impact = document.querySelector('#game-impact');
            const world = window.immersive?.world;
            const state = world?.getState();
            const render = world?.getRenderState();
            if (after && !after.hidden) {
              return Boolean(impact && !impact.hidden && impact.textContent.trim()
                && state?.current === articleId
                && state.interaction?.effectId && state.interaction.scenarioObjects?.length > 0
                && render.renderedFrames > renderedFrames && render.drawCalls > 0);
            }
            return Boolean(document.querySelector('#game-controls')?.innerText !== controlsText
              || document.querySelector('#game-result')?.textContent !== resultText);
          }, { articleId: item.articleId, controlsText: beforeAction.controlsText, resultText: beforeAction.resultText, renderedFrames: beforeAction.renderedFrames }, { polling: 'raf', timeout: timeoutMs }),
          readGameProof);
        step.actionLabel = actionLabel;
        step.isSubmission = step.gameAfterVisible;
        if (step.isSubmission) {
          assert.equal(step.current, item.articleId, `${item.articleId}: the result must belong to the selected island`);
          assert.equal(step.interaction?.kind, item.interactionType, `${item.articleId}: the world interaction type must match the article`);
          assert.ok(step.interaction?.effectId && step.interaction?.scenarioObjects?.length > 0, `${item.articleId}: the result must create actual world props`);
          assert.ok(step.renderedFrames > beforeAction.renderedFrames && step.drawCalls > 0, `${item.articleId}: the result must reach a new drawn frame`);
          assert.ok(step.impactVisible && step.impactText.length > 0, `${item.articleId}: the result must be visible to the reader`);
          island.submitResponseMs = step.responseMs;
          island.resultCharacters = Array.from(step.impactText).length;
          island.stamped = await page.evaluate(stampId => window.immersive.progress.stamps.includes(stampId), item.insightStampId);
          assert.equal(island.stamped, true, `${item.articleId}: the result must record its mapped insight stamp`);
          island.sceneProof = {
            effectId: step.interaction.effectId,
            propId: step.interaction.propId,
            action: step.interaction.action,
            layout: step.interaction.layout,
            outcomeObjectCount: step.interaction.outcomeObjectCount,
            scenarioObjects: step.interaction.scenarioObjects,
            propPosition: step.interaction.propPosition,
            propRotation: step.interaction.propRotation,
            renderedFramesBefore: beforeAction.renderedFrames,
            renderedFramesAfter: step.renderedFrames,
            drawCalls: step.drawCalls,
          };
          submitted = true;
        }
      }
      assert.equal(submitted, true, `${item.articleId}: the deterministic last-button flow must reach a visible result within eight actions`);

      await measureStep(island, 'task-close-callback',
        () => page.keyboard.press('Escape'),
        () => page.waitForFunction(() => !document.querySelector('#game')?.open
          && window.immersive?.world?.getState().encounter === null, null, { timeout: timeoutMs }),
        async () => ({ dialogClosed: true, encounterCleared: (await readWorld()).encounter === null }));

      island.status = 'passed';
    } catch (error) {
      island.status = 'failed';
      island.failure = error.stack || error.message;
      result.failure = `${item.articleId}: ${error.message}`;
      result.status = 'failed';
      await saveResults();
      break;
    }
    await saveResults();
  }

  if (!result.failure && result.islands.length === 22 && result.islands.every(island => island.status === 'passed')) {
    await captureScreenshots(cases.at(-1));
  }
} catch (error) {
  result.failure ||= error.stack || error.message;
  result.status = 'failed';
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (server) {
    server.httpServer.closeAllConnections?.();
    await server.close().catch(() => {});
  }
  if (page && result.errors.page.length + result.errors.console.length + result.errors.http.length + result.errors.requestfailed.length > 0 && !result.failure) {
    result.failure = 'browser errors were recorded';
  }
  await saveResults();
}

if (result.failure && result.status === 'running') result.status = 'failed';
if (!result.failure && result.violations.length) result.status = 'failed-latency-gate';
if (!result.failure && result.islands.length !== 22) result.status = 'failed-incomplete-corpus';
if (!result.failure && result.islands.some(island => island.status !== 'passed')) result.status = 'failed-functional-check';
if (!result.failure && (new Set(result.inventory.map(island => island.interactionType)).size !== 8
  || new Set(result.inventory.map(island => island.insightStampId)).size !== 10)) result.status = 'failed-coverage-check';
if (!result.failure && Object.values(result.errors).some(errors => errors.length)) result.status = 'failed-browser-errors';
if (!result.failure && result.status === 'running') result.status = 'passed';

await saveResults();
console.log(JSON.stringify(summary(), null, 2));
assert.equal(result.status, 'passed', `warm island interaction check failed. Full evidence: ${outputFile}`);
