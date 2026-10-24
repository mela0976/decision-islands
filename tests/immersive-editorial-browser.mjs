import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const outputDir = 'test-results/immersive-editorial/after';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const viewports = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];
const scenes = [
  { canonicalId: 'I01', motifs: ['proposal'] },
  { canonicalId: 'P01', motifs: ['flowerPaper', 'sourcePortrait', 'simulatedPortrait', 'flower-source-tag'] },
  { canonicalId: 'P04', motifs: ['fingerprint', 'originalPortrait', 'simulatedPortrait'] },
  { canonicalId: 'P07', motifs: ['fingerprint'] },
  { canonicalId: 'M01', motifs: ['originalPortrait', 'simulatedPortrait'] },
  { canonicalId: 'A03', motifs: ['flowerPaper'] },
];
const records = [];
const errors = [];

function hash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
async function closeServerWithTimeout(server, timeoutMs = 5000) {
  server.httpServer.closeAllConnections?.();
  let timer;
  try {
    await Promise.race([
      server.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Vite server did not close within ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${viewport.width}x${viewport.height}: ${error.message}`));
    await page.goto(`${origin}/immersive/index.html?acceptance=editorial`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.immersive?.world && window.immersive?.data?.scenes?.length === 22, { timeout: 30000 });
    const articleIds = await page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const island = window.immersive.data.islands.find(candidate => candidate.id === id);
      if (!island?.articleId) throw new Error(`Canonical island ${id} has no article mapping.`);
      return [id, island.articleId];
    })), scenes.map(scene => scene.canonicalId));
    await page.evaluate(() => document.fonts?.ready);
    if (await page.locator('#explore-tip').isVisible()) await page.locator('#hide-explore-tip').click();
    await mkdir(outputDir, { recursive: true });

    for (const scene of scenes) {
      const articleId = articleIds[scene.canonicalId];
      await page.evaluate(id => window.immersive.visit(id, null, false), articleId);
      await page.waitForFunction(id => window.immersive.world.getState().current === id, articleId);
      await page.waitForFunction(() => window.immersive.world.getRenderState().renderedFrames >= 8);
      await page.waitForTimeout(180);
      const state = await page.evaluate(() => ({ world: window.immersive.world.getState(), render: window.immersive.world.getRenderState() }));
      assert.equal(state.world.current, articleId);
      assert.equal(state.world.detailedIslandCount, 1, `${scene.canonicalId} keeps detail objects on the focused island`);
      const motifIds = state.world.editorialMotifs.map(motif => motif.motifId);
      for (const motif of scene.motifs) assert.ok(motifIds.includes(motif), `${scene.canonicalId} presents ${motif}`);
      assert.equal(state.render.disposed, false);
      assert.ok(state.render.editorialTextureCount >= 6, 'all shared editorial CanvasTextures are cached before rendering');

      const canvasFile = `${outputDir}/${viewport.width}-${scene.canonicalId}-${articleId}.png`;
      const pageFile = `${outputDir}/${viewport.width}-${scene.canonicalId}-${articleId}-page.png`;
      const canvasImage = await page.locator('#world').screenshot({ path: canvasFile });
      await page.screenshot({ path: pageFile, fullPage: true });
      records.push({ canonicalId: scene.canonicalId, articleId, viewport, camera: state.world.camera, motifs: state.world.editorialMotifs, render: state.render, canvasFile, pageFile, sha256: hash(canvasImage) });
    }

    const textureState = await page.evaluate(() => {
      const world = window.immersive.world;
      world.dispose();
      return world.getRenderState();
    });
    assert.equal(textureState.disposed, true);
    assert.equal(textureState.ownedTextureCount, 0);
    assert.equal(textureState.editorialTextureCount, 0);
    assert.equal(textureState.ownedMaterialCount, 0);
    assert.equal(textureState.ownedGeometryCount, 0);
    assert.ok(textureState.releasedResources.editorialTextures >= 6);
    assert.deepEqual(errors, []);
    await context.close();
  }

  const baseline = JSON.parse(await readFile('test-results/immersive-editorial/before/results.json', 'utf8'));
  for (const canonicalId of ['P01', 'P04']) {
    const articleId = records.find(record => record.canonicalId === canonicalId)?.articleId;
    const before = baseline.records.find(record => record.articleId === articleId);
    const after = records.find(record => record.canonicalId === canonicalId && record.viewport.width === 390);
    assert.ok(before && after, `${canonicalId} has same-camera mobile screenshots before and after`);
    assert.deepEqual(after.camera, before.camera, `${canonicalId} uses the baseline camera`);
  }
  const p01 = records.find(record => record.canonicalId === 'P01' && record.viewport.width === 390);
  const p04 = records.find(record => record.canonicalId === 'P04' && record.viewport.width === 390);
  const p01Original = p01.motifs.find(motif => motif.motifId === 'sourcePortrait');
  const p04Original = p04.motifs.find(motif => motif.motifId === 'originalPortrait');
  assert.equal(p01Original.textureKey, p04Original.textureKey, 'same halftone source shares a texture cache key across scenes');
  assert.deepEqual(errors, []);
  const results = { viewportCount: viewports.length, sceneCount: scenes.length, canonicalArticleIds: Object.fromEntries(records.filter(record => record.viewport.width === 390).map(({ canonicalId, articleId }) => [canonicalId, articleId])), records, errors };
  await writeFile(`${outputDir}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ viewportCount: viewports.length, sceneCount: scenes.length, canonicalArticleIds: results.canonicalArticleIds, screenshots: records.map(({ canonicalId, articleId, viewport, canvasFile, pageFile }) => ({ canonicalId, articleId, width: viewport.width, canvasFile, pageFile })), errors }, null, 2));
} finally {
  await browser.close();
  await closeServerWithTimeout(server);
}
