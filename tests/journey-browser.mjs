import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:4174/';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
async function openPicker(page) {
  if (await page.locator('#journey-picker[open]').count()) await page.keyboard.press('Escape');
  if (await page.locator('#my-reading').isVisible()) await page.locator('#my-reading').click();
  else await page.locator('#enter').click();
}
async function pick(page, audience, role, question) {
  await openPicker(page);
  await page.locator(`#journey-picker [data-audience="${audience}"]`).click();
  await page.locator(`#journey-picker [data-role="${role}"]`).click();
  if (question) await page.locator(`#journey-picker [data-question="${question}"]`).click();
  else await page.locator('[data-skip-question]').click();
  await page.locator('.journey-mission').waitFor();
}
async function boot(page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('.article-row').first().waitFor({ state: 'attached' });
}
try {
  for (const width of (process.env.TEST_WIDTH ? [Number(process.env.TEST_WIDTH)] : [1280, 390])) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await boot(page);
    await page.locator('#enter').click();
    await page.locator('[data-audience="marketing"]').click();
    await page.locator('[data-role="marketer"]').click();
    await page.locator('[data-skip-question]').click();
    const chrome = await page.locator('.masthead').boundingBox();
    const task = await page.locator('.journey-mission').boundingBox();
    assert.ok(task.y >= chrome.y + chrome.height, 'the task header stays below the global controls');
    const initialScene = await page.locator('.journey-mission-scene').innerText();
    assert.ok(initialScene.length > 15);
    assert.equal(await page.locator('.journey-insight:visible').count(), 0, 'scenario precedes the article summary');
    assert.equal(await page.locator('.journey-mission-choices [data-mission-choice]').count(), 2);
    assert.equal(await page.locator('.journey-mission [data-action="advance"]').isDisabled(), true);
    await page.locator('.journey-mission-choices [data-mission-choice="a"]').focus();
    await page.keyboard.press('Enter');
    const chosenA = await page.locator('.journey-mission-feedback').innerText();
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'a');
    assert.equal(await page.locator('.journey-mission-feedback').evaluate(el => el === document.activeElement), true);
    await page.locator('[data-mission-compare]').click();
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'a', 'comparison does not overwrite the plan');
    await page.locator('[data-mission-adopt]').click();
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'b');
    assert.notEqual(await page.locator('.journey-mission-feedback').innerText(), chosenA);
    const chosenB = await page.locator('.journey-mission-choices [data-mission-choice="b"] strong').innerText();
    await page.locator('#season').selectOption('halloween');
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'), 'b');
    await page.locator('.journey-mission-source summary').click();
    await page.locator('.journey-mission-source [data-read-article]').click();
    await page.locator('#reader[open]').waitFor();
    assert.match(await page.locator('#reader-title').innerText(), /GEO/);
    assert.match(await page.locator('.journey-reader-context').innerText(), /1\s*\/\s*3/);
    await page.locator('#bookmark').click();
    await page.locator('#next-article').click();
    assert.equal(await page.locator('#reader[open]').count(), 0, 'reader next returns to the next situation');
    assert.equal(await page.locator('.journey-current-step').getAttribute('data-step-current'), '1');
    assert.ok((await page.locator('.journey-mission-condition').innerText()).includes(chosenB));
    await page.locator('[data-action="mission-skip"]').click();
    await page.locator('.journey-mission-choices [data-mission-choice="a"]').click();
    await page.locator('[data-action="mission-plan"]').click();
    const incomplete = await page.locator('.journey-mission-plan').innerText();
    assert.match(incomplete, /2\s*\/\s*3/);
    assert.match(incomplete, /已略過，尚未決定/);
    await page.locator('.journey-step-marker[data-step="1"]').click();
    await page.locator('.journey-mission-choices [data-mission-choice="b"]').click();
    await page.locator('[data-action="advance"]').click();
    assert.match(await page.locator('.journey-mission-plan').innerText(), /3\s*\/\s*3/);
    assert.ok((await page.locator('.journey-mission-plan').innerText()).includes(chosenB));
    await page.locator('#my-reading').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.journey-mission:visible').count(), 1, 'cancel returns to the current mission');
    await page.locator('.journey-mission [data-action="mission-plan"]').click();
    await page.screenshot({ path: `test-results/mission-plan-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-mission-restart]').click();
    assert.equal(await page.locator('.journey-mission-feedback').count(), 0);
    assert.equal(await page.locator('.journey-current-step').getAttribute('data-step-current'), '0');
    await page.locator('.journey-mission-choices [data-mission-choice="a"]').click();
    await page.locator('[data-mission-retry]').click();
    assert.equal(await page.locator('.journey-mission-feedback').count(), 0);
    await pick(page, 'everyday', 'family');
    assert.notEqual(await page.locator('.journey-mission-scene').innerText(), initialScene);
    assert.equal(await page.locator('.journey-mission-feedback').count(), 0, 'another role has its own answers');
    await page.screenshot({ path: `test-results/mission-scene-${width}.png` });
    results.push(`${width}px: concrete scenario, keyboard choice, distinct feedback, nonmutating comparison/adoption, previous plan conditions, source reader next, skips, 3-round plan, replay, retry, role isolation and holiday retention`);
    await context.close();
  }
  if (!process.env.TEST_WIDTH) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return String(type).includes('webgl') ? null : get.call(this, type, ...args); };
    });
    const page = await context.newPage(); await boot(page);
    const routes = [];
    for (const audience of ['marketing', 'everyday']) {
      await openPicker(page);
      await page.locator(`#journey-picker [data-audience="${audience}"]`).click();
      const roles = await page.locator('#journey-picker [data-role]').evaluateAll(nodes => nodes.map(node => node.dataset.role));
      for (const role of roles) {
        await openPicker(page);
        await page.locator(`#journey-picker [data-audience="${audience}"]`).click();
        await page.locator(`#journey-picker [data-role="${role}"]`).click();
        const questions = await page.locator('#journey-picker [data-question]').evaluateAll(nodes => nodes.map(node => node.dataset.question));
        for (const question of questions) routes.push({ audience, role, question });
        await page.keyboard.press('Escape');
      }
    }
    const ids = new Set(); const scenes = new Set();
    assert.equal(routes.length, 16);
    for (const route of routes) {
      await pick(page, route.audience, route.role, route.question);
      for (let index = 0; index < 3; index++) {
        ids.add(await page.locator('.journey-mission').getAttribute('data-mission-id'));
        scenes.add(await page.locator('.journey-mission-scene').innerText());
        await page.locator('.journey-mission-choices [data-mission-choice="a"]').click();
        assert.ok((await page.locator('.journey-mission-feedback').innerText()).length > 50);
        if (index < 2) await page.locator('[data-action="advance"]').click();
      }
      assert.match(await page.locator('.journey-mission-plan').innerText(), /3\s*\/\s*3/);
    }
    assert.equal(ids.size, 48); assert.equal(scenes.size, 48);
    results.push('All eight roles and sixteen tasks offer 48 distinct playable rounds without WebGL; all produce actual three-choice plans');
    await context.close();
    const english = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const ep = await english.newPage(); await ep.goto(new URL('?lang=en', base).href);
    await ep.locator('.article-row').first().waitFor({ state: 'attached' });
    await pick(ep, 'everyday', 'newcomer');
    await ep.locator('.journey-mission-choices [data-mission-choice="a"]').click();
    assert.match(await ep.locator('.journey-mission-feedback').innerText(), /Possible effect/);
    assert.doesNotMatch(await ep.locator('.journey-mission-scene').innerText(), /[\u4e00-\u9fff]/);
    await ep.reload();
    await ep.locator('.article-row').first().waitFor({ state: 'attached' });
    await pick(ep, 'everyday', 'newcomer');
    assert.equal(await ep.locator('.journey-mission-feedback').count(), 0, 'page reload clears the session-only choices');
    results.push('English mobile scenario/feedback works; page reload starts a fresh task session');
    await english.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('test-results/mission-results.json', JSON.stringify({ base, results, errors }, null, 2));
  console.log(results.join('\n'));
} finally { await browser.close(); }
