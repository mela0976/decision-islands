import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : '@playwright/test');
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [], errors = [];
await mkdir('test-results/immersive-navigation', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4186/immersive/');
  await page.waitForFunction(() => window.immersive?.world);
  await page.evaluate(async () => {
    const { createWorld } = await import(new URL('world.js', location.href).href);
    const data = window.immersive.data;
    window.immersive.world.dispose();
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:999'; document.body.append(canvas);
    window.navigationEvents = [];
    window.navigationWorld = await createWorld({ canvas, data, reducedMotion: true, onTransitionStage: (stage, detail) => window.navigationEvents.push({ stage, ...detail }) });
  });
  const routes = await page.evaluate(() => {
    const world = window.navigationWorld;
    world.focus('P01', { animate: false });
    const ids = ['P04', 'M01', 'A06'];
    world.setRecommendations(ids.map((targetArticleId, priority) => ({ sourceArticleId: 'P01', targetArticleId, relationType: 'research-validation', editorialReason: '核對觀點的證據與限制', transitionQuestion: '下一步要核對什麼？', priority })));
    world.preview('P04'); const preview = world.getState(); world.preview(null); const cleared = world.getState();
    return { preview, cleared };
  });
  assert.equal(routes.preview.recommendations.length, 3);
  assert.equal(routes.preview.recommendations.filter(route => route.previewVisible).length, 1);
  assert.equal(routes.preview.current, '2026-03');
  assert.ok(routes.preview.recommendations.every(route => route.points.length === 3 && route.editorialReason));
  assert.equal(routes.cleared.previewed, null);
  assert.ok(routes.cleared.recommendations.every(route => !route.previewVisible));
  results.push({ recommendations: routes });
  for (const [from, to, kind] of [['P01', 'P04', 'photo-evidence-bridge'], ['P05', 'A06', 'product-service-journey'], ['M01', 'M03', 'model-limits-scale']]) {
    await page.evaluate(({ from, to }) => { const world = window.navigationWorld; world.setReducedMotion(true); world.focus(from, { animate: false }); window.navigationEvents = []; world.setReducedMotion(false); world.focus(to, { relation: { transitionQuestion: '帶著上一幕的問題往前走' } }); }, { from, to });
    await page.waitForFunction(() => { const state = window.navigationWorld.getState(); return state.carry.visible && state.carry.morph > .35; });
    const during = await page.evaluate(() => window.navigationWorld.getState());
    assert.equal(during.carry.kind, kind); assert.ok(during.carry.objectCount > 3);
    if (from === 'P01') assert.ok(during.carry.shapes.evidenceCards.every(card => card.visible && card.rotationX < 0));
    if (from === 'P05') assert.ok(during.carry.shapes.serviceSteps.every(step => step.visible && step.scale > .35));
    if (from === 'M01') assert.ok(during.carry.shapes.cardFlip > 1 && during.carry.shapes.frameworkScale > .35);
    await page.screenshot({ path: `test-results/immersive-navigation/${from}-${to}-carry.png` });
    await page.waitForFunction(() => !window.navigationWorld.getState().transitioning);
    const arrival = await page.evaluate(() => ({ state: window.navigationWorld.getState(), events: window.navigationEvents }));
    assert.deepEqual(arrival.events.map(event => event.stage), ['settle', 'question', 'carry', 'sail', 'arrival']);
    assert.ok(arrival.events.at(-1).arrivalLine); assert.ok(arrival.state.speech);
    assert.equal(arrival.state.recommendations.length, 0);
    if (to === 'A06') assert.equal(arrival.events.at(-1).arrivalEvent.kind, 'ending-return-achi');
    results.push({ from, to, during, arrival });
  }
  const lifecycle = await page.evaluate(() => {
    const world = window.navigationWorld; world.focus('P01', { animate: false }); world.focus('P04'); world.cancelTransition(); const cancelled = world.getState(); world.focus('A06'); world.skipTransition(); const skipped = world.getState(); world.focus('M01'); world.setReducedMotion(true); return { cancelled, skipped, reduced: world.getState() };
  });
  assert.equal(lifecycle.cancelled.current, '2026-03'); assert.equal(lifecycle.cancelled.carry.visible, false);
  assert.equal(lifecycle.skipped.current, '2026-22'); assert.equal(lifecycle.skipped.transitioning, false);
  assert.equal(lifecycle.reduced.current, '2026-12'); assert.equal(lifecycle.reduced.transitioning, false);
  assert.ok(lifecycle.reduced.coastLinks.every(link => link.kind !== 'coastal-boardwalk' || link.distance <= 23));
  assert.ok(lifecycle.reduced.exploredLightCount >= 6);
  assert.deepEqual(errors, []);
  results.push({ lifecycle, errors });
  await writeFile('test-results/immersive-navigation/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ cases: results.length, errors }));
} finally { await browser.close(); }
