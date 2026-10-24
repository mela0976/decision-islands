import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const output = 'test-results/immersive-navigation-ui';
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-webgl'] });
const records = [], errors = [];
const worldStub = `
export async function createWorld(options) {
  const state = { current: options.data.islands[0].articleId, stage: 'arrival' };
  window.__fireObject = options.onObjectSelect;
  const world = {
    focus(id) { state.current = id; state.stage = 'arrival'; options.onTransitionStage?.('arrival', { question: '已抵達文章島。' }); },
    getState() { return state; },
    setPopulation() {}, setReducedMotion() {}, setSeason() {}, setMode() {},
    setEncounter() {}, setSpeech() {}, setRecommendations() {}, setActive(active) { if (active) delete document.body.dataset.islandPreview; },
    setArrivalEnabled() {}, playArrival() {}, skipArrival() {}, cancelArrival() {},
    preview(id) { if (id) document.body.dataset.islandPreview = 'true'; else delete document.body.dataset.islandPreview; }, applyInteraction() {}, setSound() {}, dispose() {},
  };
  return world;
}`;

async function recommendationIsVisibleInReader(page, button) {
  return button.evaluate(element => {
    const rect = element.getBoundingClientRect(), reader = document.querySelector('#reader').getBoundingClientRect();
    return rect.height > 0 && rect.top >= reader.top + 32 && rect.bottom <= reader.bottom - 24;
  });
}

async function wheelRecommendationIntoView(page, button) {
  const reader = await page.locator('#reader').boundingBox();
  for (let i = 0; i < 20 && !await recommendationIsVisibleInReader(page, button); i++) {
    await page.mouse.move(reader.x + reader.width / 2, reader.y + reader.height - 90);
    await page.mouse.wheel(0, 640);
    await page.waitForTimeout(35);
  }
  assert.equal(await recommendationIsVisibleInReader(page, button), true, 'normal reader scrolling exposes the recommendation button');
}

async function swipeRecommendationIntoView(page, session, button) {
  const reader = await page.locator('#reader').boundingBox();
  for (let i = 0; i < 24 && !await recommendationIsVisibleInReader(page, button); i++) {
    const x = reader.x + reader.width / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: reader.y + reader.height - 80, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: reader.y + 145, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(50);
  }
  assert.equal(await recommendationIsVisibleInReader(page, button), true, 'touch swipes expose the recommendation button');
  await page.waitForTimeout(300);
  let previous = await button.boundingBox();
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(100);
    const next = await button.boundingBox();
    if (Math.abs(next.y - previous.y) < 1 && Math.abs(next.x - previous.x) < 1) return;
    previous = next;
  }
  assert.fail('touch scroll must settle before the tap');
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { if (!localStorage.getItem('decision-immersive-progress-v1')) localStorage.setItem('decision-immersive-progress-v1', JSON.stringify({ last: '2026-03', routes: [] })); });
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.route('**/immersive/world.js*', route => route.fulfill({ contentType: 'text/javascript', body: worldStub }));
  await page.goto(`${origin}/immersive/index.html`);
  await page.waitForFunction(() => window.immersive?.world);
  assert.equal(await page.locator('#population').isDisabled(), false);
  assert.equal(await page.locator('#season').isDisabled(), false);
  assert.equal(await page.locator('#return-source').isHidden(), true);

  const route = await page.evaluate(() => {
    const api = window.immersive;
    const from = api.data.islands.find(island => island.id === 'P01').articleId;
    const to = api.data.islands.find(island => island.id === 'P04').articleId;
    const edge = api.data.articleGraph.find(item => item.sourceArticleId === from && item.targetArticleId === to);
    return { from, to, title: api.data.articles.find(article => article.id === to).title, sourceTitle: api.data.articles.find(article => article.id === from).title, hasArticleGraphEdge: Boolean(edge) };
  });
  assert.equal(route.hasArticleGraphEdge, true);
  await page.evaluate(id => window.__fireObject({ kind: 'microevent', articleId: id, objectId: 'garden-door' }), route.to);
  assert.equal(await page.evaluate(() => window.immersive.progress.last), route.from);
  assert.equal(await page.locator('#game').evaluate(dialog => dialog.open), false);

  await page.locator('#map-toggle').click();
  await page.locator('#article-list button').filter({ hasText: 'P01' }).click();
  await page.locator('#read').click();
  const recommendationButton = page.locator('#recommendations button').filter({ hasText: route.title });
  await page.evaluate(() => {
    window.__pointerSequence = [];
    for (const type of ['pointerdown', 'pointerup', 'click']) document.querySelector('#recommendations').addEventListener(type, event => {
      const button = event.target.closest('button'), reader = document.querySelector('#reader').getBoundingClientRect(), rect = button?.getBoundingClientRect();
      window.__pointerSequence.push({ type, pointerType: event.pointerType || 'mouse', label: button?.textContent.slice(0, 72), x: event.clientX, y: event.clientY, buttonRect: rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null, readerHeight: reader.height, preview: document.body.dataset.islandPreview === 'true' });
    }, true);
  });
  await wheelRecommendationIntoView(page, recommendationButton);
  const pointerTarget = await recommendationButton.boundingBox();
  const pointerX = pointerTarget.x + pointerTarget.width / 2, pointerY = pointerTarget.y + pointerTarget.height / 2;
  const readerBeforeHover = await page.locator('#reader').evaluate(dialog => dialog.getBoundingClientRect().height);
  await page.mouse.move(pointerX, pointerY);
  const hoveredButton = await recommendationButton.boundingBox();
  const hoverPreview = await page.evaluate(() => ({ active: document.body.dataset.islandPreview === 'true', readerHeight: document.querySelector('#reader').getBoundingClientRect().height }));
  const pointerStillOverButton = pointerX >= hoveredButton.x && pointerX <= hoveredButton.x + hoveredButton.width && pointerY >= hoveredButton.y && pointerY <= hoveredButton.y + hoveredButton.height;
  assert.ok(pointerStillOverButton, JSON.stringify({ pointerTarget, hoveredButton, hoverPreview }));
  assert.ok(Math.abs(hoverPreview.readerHeight - readerBeforeHover) < 1, JSON.stringify({ readerBeforeHover, hoverPreview }));
  await page.mouse.down();
  await page.mouse.up();
  const arrivalState = await page.evaluate(() => ({ progress: window.immersive.progress.last, current: window.immersive.world.getState().current, stage: window.immersive.world.getState().stage, readerOpen: document.querySelector('#reader').open }));
  assert.equal(arrivalState.current, route.to, JSON.stringify({ arrivalState, errors }));
  assert.equal(arrivalState.stage, 'arrival');
  const pointerSequence = await page.evaluate(() => window.__pointerSequence);
  assert.deepEqual(pointerSequence.map(event => event.type), ['pointerdown', 'pointerup', 'click']);
  assert.ok(pointerSequence.every(event => event.label?.includes(route.title)));
  assert.ok(hoverPreview.active);
  assert.ok(pointerSequence.some(event => event.preview));
  assert.equal(await page.locator('#island-title').innerText(), route.title);
  assert.match(await page.locator('#return-source').innerText(), /P01/);
  assert.doesNotMatch(await page.locator('#return-source').innerText(), new RegExp(route.sourceTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(await page.locator('#return-source').getAttribute('aria-label'), new RegExp(route.sourceTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(await page.locator('#return-source').isVisible());
  assert.ok((await page.locator('#return-source').boundingBox()).height >= 44);
  await page.screenshot({ path: `${output}/recommended-arrival.png` });

  await page.locator('#return-source').click();
  await page.waitForFunction(id => window.immersive.progress.last === id, route.from);
  assert.equal(await page.locator('#return-source').isHidden(), true);
  assert.match(await page.locator('#chapter-label').innerText(), /P01/);

  await page.locator('#map-toggle').click();
  const manual = await page.evaluate(() => window.immersive.data.islands.find(island => island.id === 'P03').articleId);
  await page.locator('#article-list button').filter({ hasText: 'P03' }).click();
  assert.equal(await page.evaluate(() => window.immersive.progress.last), manual);
  assert.match(await page.locator('#return-source').innerText(), /P01/);
  await page.locator('#return-source').click();
  await page.waitForFunction(id => window.immersive.progress.last === id, route.from);
  assert.equal(await page.locator('#return-source').isHidden(), true);

  await page.locator('#map-toggle').click();
  await page.locator('#article-list button').filter({ hasText: 'P04' }).click();
  await page.evaluate(() => sessionStorage.removeItem('decision-immersive-navigation-v1'));
  await page.reload();
  await page.waitForFunction(() => window.immersive?.world);
  assert.equal(await page.evaluate(() => window.immersive.progress.last), route.to);
  assert.match(await page.locator('#return-source').innerText(), /P01/);
  await page.locator('#return-source').click();
  await page.waitForFunction(id => window.immersive.progress.last === id, route.from);
  assert.equal(await page.locator('#return-source').isHidden(), true);

  const issueOrder = await page.evaluate(() => {
    const index = window.immersive.data.articles.findIndex(article => article.id === window.immersive.progress.last);
    return {
      current: window.immersive.progress.last,
      next: window.immersive.data.articles[(index + 1) % 22].id,
    };
  });
  await page.locator('#next').click();
  assert.equal(await page.evaluate(() => window.immersive.progress.last), issueOrder.next);
  await page.locator('#previous').click();
  assert.equal(await page.evaluate(() => window.immersive.progress.last), issueOrder.current);

  const mobileReturn = await page.evaluate(() => window.immersive.data.islands.find(island => island.id === 'M05').articleId);
  await page.locator('#map-toggle').click();
  await page.locator('#article-list button').filter({ hasText: 'M05' }).click();
  const mobileStory = await page.evaluate(() => {
    const story = document.querySelector('#story').getBoundingClientRect();
    const actions = document.querySelector('#story .actions').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('#story .actions button')].map(button => { const rect = button.getBoundingClientRect(); return { text: button.textContent, top: rect.top, bottom: rect.bottom, height: rect.height }; });
    return { story: { top: story.top, bottom: story.bottom, height: story.height }, actions: { top: actions.top, bottom: actions.bottom }, buttons, replayVisible: !document.querySelector('#replay-arrival').hidden, returnVisible: !document.querySelector('#return-source').hidden, viewportHeight: innerHeight };
  });
  assert.ok(mobileStory.buttons.filter(button => ['走進情境', '閱讀原文'].includes(button.text)).every(button => button.top >= mobileStory.story.top && button.bottom <= mobileStory.story.bottom && button.height >= 44));
  assert.equal(mobileStory.replayVisible, true);
  assert.equal(mobileStory.returnVisible, true);
  assert.ok(mobileStory.viewportHeight - mobileStory.story.height >= mobileStory.viewportHeight * .39);
  await page.screenshot({ path: `${output}/mobile-actions-visible.png` });

  await page.locator('#read').click();
  await page.locator('[data-depth="full"]').click();
  await page.locator('#note').fill('手機預覽期間保留的筆記');
  await page.waitForFunction(() => document.querySelector('#note-status').textContent === '已儲存在這個瀏覽器');
  const readerBeforePreview = await page.locator('#reader').evaluate(dialog => ({ height: dialog.getBoundingClientRect().height, maxScroll: dialog.scrollHeight - dialog.clientHeight }));
  assert.ok(readerBeforePreview.maxScroll > 0);
  await page.evaluate(() => window.immersive.world.preview(window.immersive.progress.last));
  const readerDuringPreview = await page.evaluate(() => ({ height: document.querySelector('#reader').getBoundingClientRect().height, viewportHeight: innerHeight, backdropFilter: getComputedStyle(document.querySelector('#reader'), '::backdrop').backdropFilter, note: document.querySelector('#note').value, open: document.querySelector('#reader').open, maxScroll: document.querySelector('#reader').scrollHeight - document.querySelector('#reader').clientHeight }));
  assert.ok(readerBeforePreview.height <= readerDuringPreview.viewportHeight * .58 + 1);
  assert.ok(readerDuringPreview.viewportHeight - readerDuringPreview.height >= readerDuringPreview.viewportHeight * .39);
  assert.ok(Math.abs(readerDuringPreview.height - readerBeforePreview.height) < 1);
  assert.equal(readerDuringPreview.backdropFilter, 'none');
  assert.equal(readerDuringPreview.note, '手機預覽期間保留的筆記');
  assert.equal(readerDuringPreview.open, true);
  assert.ok(readerDuringPreview.maxScroll > 0);
  await page.screenshot({ path: `${output}/mobile-reader-preview.png` });
  await page.evaluate(() => window.immersive.world.preview(null));
  assert.ok(await page.locator('#reader').evaluate(dialog => Math.abs(dialog.getBoundingClientRect().height - 58 * window.innerHeight / 100) < 2));
  await page.locator('#reader form button').click();
  await page.locator('#read').click();
  assert.equal(await page.locator('#note').inputValue(), '手機預覽期間保留的筆記');
  await page.locator('#reader form button').click();
  assert.equal(await page.evaluate(() => window.immersive.progress.last), mobileReturn);
  assert.equal(errors.length, 0, errors.join('\\n'));

  const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  touchPage.setDefaultTimeout(5000);
  touchPage.on('pageerror', error => errors.push(error.message));
  await touchPage.addInitScript(() => { if (!localStorage.getItem('decision-immersive-progress-v1')) localStorage.setItem('decision-immersive-progress-v1', JSON.stringify({ last: '2026-03', routes: [] })); });
  await touchPage.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await touchPage.route('**/immersive/world.js*', route => route.fulfill({ contentType: 'text/javascript', body: worldStub }));
  await touchPage.goto(`${origin}/immersive/index.html`);
  await touchPage.waitForFunction(() => window.immersive?.world);
  await touchPage.locator('#map-toggle').click();
  await touchPage.locator('#article-list button').filter({ hasText: 'P01' }).click();
  await touchPage.locator('#read').click();
  const touchRecommendation = touchPage.locator('#recommendations button').filter({ hasText: route.title });
  const touchCdp = await touchPage.context().newCDPSession(touchPage);
  await swipeRecommendationIntoView(touchPage, touchCdp, touchRecommendation);
  await touchRecommendation.evaluate(button => { button.dataset.touchTarget = 'true'; });
  await touchPage.evaluate(() => {
    window.__touchSequence = [];
    window.__touchTimeline = [];
    const capture = event => {
      const target = event.target, button = target.closest?.('button'), reader = document.querySelector('#reader').getBoundingClientRect(), expected = document.querySelector('[data-touch-target="true"]')?.getBoundingClientRect();
      window.__touchTimeline.push({ type: event.type, pointerType: event.pointerType || null, target: { tag: target.tagName, id: target.id, label: button?.textContent.slice(0, 72) || null }, activeElement: document.activeElement?.tagName + (document.activeElement?.id ? `#${document.activeElement.id}` : ''), readerHeight: reader.height, targetRect: expected ? { top: expected.top, bottom: expected.bottom } : null, preview: document.body.dataset.islandPreview === 'true' });
    };
    for (const type of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'pointerover', 'pointerenter', 'pointerout', 'pointerleave', 'mouseover', 'mouseenter', 'mouseout', 'mouseleave', 'mousedown', 'mouseup', 'focusin', 'focusout', 'click']) document.addEventListener(type, capture, true);
    new MutationObserver(() => window.__touchTimeline.push({ type: 'body-preview-change', value: document.body.dataset.islandPreview || null, readerHeight: document.querySelector('#reader').getBoundingClientRect().height, targetRect: (() => { const rect = document.querySelector('[data-touch-target="true"]')?.getBoundingClientRect(); return rect ? { top: rect.top, bottom: rect.bottom } : null; })() })).observe(document.body, { attributes: true, attributeFilter: ['data-island-preview'] });
    for (const type of ['pointerdown', 'pointerup', 'click']) document.querySelector('#recommendations').addEventListener(type, event => {
      const button = event.target.closest('button'), expected = document.querySelector('[data-touch-target="true"]'), reader = document.querySelector('#reader').getBoundingClientRect(), rect = button?.getBoundingClientRect(), expectedRect = expected?.getBoundingClientRect();
      window.__touchSequence.push({ type, pointerType: event.pointerType || 'mouse', eventTarget: { tag: event.target.tagName, id: event.target.id, label: button?.textContent.slice(0, 72) || null }, label: button?.textContent.slice(0, 72), x: event.clientX, y: event.clientY, eventButtonRect: rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null, expectedButtonRect: expectedRect ? { top: expectedRect.top, bottom: expectedRect.bottom, left: expectedRect.left, right: expectedRect.right } : null, readerHeight: reader.height, scrollTop: document.querySelector('#reader').scrollTop, preview: document.body.dataset.islandPreview === 'true' });
    }, true);
  });
  const touchTarget = await touchRecommendation.boundingBox();
  await touchRecommendation.tap();
  const touchArrival = await touchPage.evaluate(() => ({ progress: window.immersive.progress.last, current: window.immersive.world.getState().current, readerOpen: document.querySelector('#reader').open, events: window.__touchSequence, timeline: window.__touchTimeline, activeElement: document.activeElement?.tagName + (document.activeElement?.id ? `#${document.activeElement.id}` : ''), elementAtTap: document.elementFromPoint(195, 577)?.tagName }));
  assert.equal(touchArrival.current, route.to, JSON.stringify({ touchArrival, pointerSequence, hoverPreview }));
  assert.equal(touchArrival.readerOpen, false);
  assert.deepEqual(touchArrival.events.map(event => event.type), ['pointerdown', 'pointerup', 'click']);
  assert.ok(touchArrival.events.every(event => event.label?.includes(route.title)));
  assert.equal(touchArrival.events[0].pointerType, 'touch');
  records.push({ route: { from: route.from, to: route.to, hasArticleGraphEdge: route.hasArticleGraphEdge }, issueOrder, pointerTarget: { x: pointerX, y: pointerY }, readerBeforeHover, hoveredButton, pointerStillOverButton, hoverPreview, pointerSequence, mobileStory, readerBeforePreview, readerDuringPreview, touchArrival, errors, world: 'CPU-only stub; verifies app DOM, route selection, mobile layout, preview CSS and real mouse/touch inputs, not curved 3D travel.' });
  await writeFile(`${output}/results.json`, JSON.stringify(records, null, 2));
  console.log(JSON.stringify({ records, output }));
  await touchPage.close();
  await page.close();
} finally {
  await browser.close();
  server.httpServer.closeAllConnections?.();
  await server.close();
}
