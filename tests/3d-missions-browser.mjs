import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:4174/';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [], errors = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function boot(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', ...options });
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('.article-row').first().waitFor({ state: 'attached' });
  return { ctx, page };
}
async function picker(page) {
  if (await page.locator('#journey-picker[open]').count()) await page.keyboard.press('Escape');
  if (await page.locator('#my-reading').isVisible()) await page.locator('#my-reading').click();
  else await page.locator('#enter').click();
}
async function task(page, audience, role, question) {
  await picker(page);
  await page.locator(`#journey-picker [data-audience="${audience}"]`).click();
  await page.locator(`#journey-picker [data-role="${role}"]`).click();
  if (question) await page.locator(`#journey-picker [data-question="${question}"]`).click();
  else await page.locator('[data-skip-question]').click();
  await page.locator('.mission-stage[data-renderer="webgl"] canvas').waitFor();
  assert.equal(await page.locator('.mission-stage svg').count(), 0, 'normal path uses actual 3D rather than a hidden SVG');
}
async function pixels(page) {
  const canvas = page.locator('.mission-stage-canvas');
  let bounds = await canvas.boundingBox();
  if (bounds.y < 0 || bounds.y + bounds.height > page.viewportSize().height) {
    await canvas.scrollIntoViewIfNeeded();
    bounds = await canvas.boundingBox();
  }
  return hash(await page.screenshot({clip:{x:Math.ceil(bounds.x)+2,y:Math.ceil(bounds.y)+56,width:Math.floor(bounds.width)-4,height:Math.floor(bounds.height)-58}}));
}
try {
  if (!process.env.TEST_MOTION_ONLY) {
  const { ctx, page } = await boot();
  const routes = [];
  for (const audience of ['marketing', 'everyday']) {
    await picker(page); await page.locator(`[data-audience="${audience}"]`).click();
    const roles = await page.locator('#journey-picker [data-role]').evaluateAll(nodes => nodes.map(node => node.dataset.role));
    for (const role of roles) {
      await picker(page); await page.locator(`[data-audience="${audience}"]`).click();
      await page.locator(`#journey-picker [data-role="${role}"]`).click();
      const questions = await page.locator('#journey-picker [data-question]').evaluateAll(nodes => nodes.map(node => node.dataset.question));
      questions.forEach(question => routes.push({ audience, role, question }));
    }
  }
  const captured = new Set(), missions = new Set();
  for (const route of routes) {
    await task(page, route.audience, route.role, route.question);
    for (let round = 0; round < 3; round++) {
      const id = await page.locator('.journey-mission').getAttribute('data-mission-id'); missions.add(id);
      if (await page.locator('[data-mission-retry]').count()) await page.locator('[data-mission-retry]').click();
      const initial = await pixels(page);
      await page.evaluate(() => { window.__missionCanvas = document.querySelector('.mission-stage-canvas'); });
      await page.locator('.journey-mission-choices [data-mission-choice="a"]').click();
      const a = await pixels(page); assert.notEqual(a, initial, `${id} A has real pixel changes`);
      if (!captured.has(route.role)) { await page.locator('.mission-stage').screenshot({ path: `test-results/3d-role-${route.role}.png` }); captured.add(route.role); }
      await page.locator('.journey-mission-choices [data-mission-choice="b"]').click();
      const b = await pixels(page); assert.notEqual(a, b, `${id} has distinct 3D outcomes`);
      assert.equal(await page.evaluate(() => window.__missionCanvas === document.querySelector('.mission-stage-canvas')), true, 'one renderer survives rail redraw');
      if (!round) {
        await page.locator('[data-mission-compare]').click();
        assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'b');
        assert.equal(await pixels(page), a, 'preview shows A without overwriting B');
        await page.locator('[data-mission-compare]').click(); assert.equal(await pixels(page), b);
        await page.locator('[data-mission-retry]').click(); assert.equal(await pixels(page), initial);
        await page.locator('.journey-mission-choices [data-mission-choice="b"]').click();
      }
      if (round < 2) await page.locator('.journey-mission [data-action="advance"]').click();
    }
  }
  assert.equal(missions.size, 48); assert.equal(captured.size, 8);
  results.push('Real WebGL renders all 48 rounds and 96 physically distinct branch outcomes, eight role screenshots, stable canvas, preview isolation and retry');
  await ctx.close();
  for (const [width, height] of [[390, 844], [360, 740]]) {
    const { ctx, page } = await boot({ viewport: { width, height } });
    await task(page, 'everyday', 'family');
    const stage = await page.locator('.mission-stage').boundingBox();
    assert.ok(stage.width > 290 && stage.y >= 0 && stage.y + stage.height < height);
    for (const box of await page.locator('.journey-mission-choices [data-mission-choice]').evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom, height: node.getBoundingClientRect().height })))) assert.ok(box.top >= 0 && box.bottom < height && box.height >= 44);
    await page.locator('.journey-mission-choices [data-mission-choice="a"]').click();
    await page.locator('#season').selectOption('easter');
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'a');
    await page.screenshot({ path: `test-results/3d-mobile-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await ctx.close(); results.push(`${width}x${height}: real 3D stage and both actions visible, holiday retains answer`);
  }
  }
  {
    const { ctx, page } = await boot();
    await task(page, 'everyday', 'family');
    const before = await pixels(page);
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.fastForward(32);
    await page.waitForFunction(() => !matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('#motion').getAttribute('aria-pressed') === 'true');
    await page.locator('.journey-mission-choices [data-mission-choice="a"]').evaluate(button => button.click());
    assert.equal(await page.locator('.mission-stage-canvas').getAttribute('data-animating'), 'true');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'), 'approach');
    await page.clock.fastForward(550);
    const mid = await pixels(page);
    await page.clock.fastForward(650);
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'), 'interact');
    const interacting = await pixels(page);
    assert.notEqual(mid,interacting,'approach and operation have distinct rendered states');
    await page.screenshot({path:'test-results/3d-action-closeup.png'});
    await page.clock.fastForward(1750);
    const after = await pixels(page);
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'), 'result');
    assert.notEqual(before, mid); assert.notEqual(mid, after, 'animation has visible intermediate rendered frames');
    await page.locator('.mission-stage-replay').evaluate(button => button.click()); await page.clock.fastForward(450);
    assert.notEqual(await pixels(page), after, 'replay visibly restarts the action');
    await page.locator('#motion').evaluate(button => button.click());
    await page.clock.fastForward(100);
    assert.equal(await pixels(page), after, 'pause settles at the correct outcome');
    const bounds = await page.locator('.mission-stage-canvas').boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2, { steps: 5 });
    await page.mouse.up();
    assert.notEqual(await pixels(page), after, 'dragging changes the actual 3D viewpoint');
    await page.locator('.journey-mission-choices [data-mission-choice="b"]').evaluate(button => button.click());
    await page.locator('[data-mission-compare]').evaluate(button => button.click());
    await page.locator('.mission-stage-canvas').evaluate(canvas => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
    await page.locator('.mission-stage[data-renderer="fallback"] svg').waitFor();
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'b', 'context loss preserves adopted answer during preview');
    assert.equal(await page.locator('.mission-stage').getAttribute('data-choice-id'), 'a');
    assert.equal(await page.locator('.mission-stage').getAttribute('data-preview'), 'true');
    assert.match(await page.locator('.mission-stage figcaption').textContent(), /預覽/);
    await page.locator('[data-mission-compare]').evaluate(button => button.click());
    assert.equal(await page.locator('.mission-stage').getAttribute('data-choice-id'), 'b');
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'b');
    await ctx.close(); results.push('Visible intermediate 3D animation, replay, pause terminal state and WebGL context loss fallback preserve playable choices');
  }
  for (const sample of [
    {role:'family',question:'family-trust',step:'2',name:'human-review'},
    {role:'commuter',question:'shopping-help',step:'1',name:'shopping-control'},
  ]) {
    const {ctx,page} = await boot();
    await task(page,'everyday',sample.role,sample.question);
    await page.locator(`.journey-step-marker[data-step="${sample.step}"]`).evaluate(button => button.click());
    const before = await pixels(page);
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.clock.fastForward(32);
    await page.waitForFunction(() => !matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('#motion').getAttribute('aria-pressed') === 'true');
    await page.locator('.journey-mission-choices [data-mission-choice="b"]').evaluate(button => button.click());
    await page.clock.fastForward(650);
    const middle = await pixels(page);
    await page.screenshot({path:`test-results/3d-action-${sample.name}-middle.png`});
    await page.clock.fastForward(2200);
    const after = await pixels(page);
    assert.notEqual(before,middle); assert.notEqual(middle,after);
    await page.screenshot({path:`test-results/3d-action-${sample.name}-after.png`});
    await ctx.close(); results.push(`${sample.name}: distinct intermediate and terminal 3D action frames`);
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`test-results/3d-mission${process.env.TEST_MOTION_ONLY ? '-motion' : ''}-results.json`, JSON.stringify({ base, results, errors }, null, 2));
  await browser.close();
}
console.log(results.join('\n'));
