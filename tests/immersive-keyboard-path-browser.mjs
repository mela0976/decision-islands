import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const output = 'test-results/immersive-keyboard-path';
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const journeys = [];
await mkdir(output, { recursive: true });

async function active(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    return {
      tag: element?.tagName?.toLowerCase() || '',
      id: element?.id || '',
      className: typeof element?.className === 'string' ? element.className : '',
      text: (element?.innerText || element?.value || element?.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100),
      outline: getComputedStyle(element).outlineStyle,
      depth: element?.dataset?.depth || '',
      inIntro: Boolean(element?.closest?.('#intro')),
      inCatalog: Boolean(element?.closest?.('#catalog')),
      inReader: Boolean(element?.closest?.('#reader')),
      inGame: Boolean(element?.closest?.('#game')),
    };
  });
}

async function tabTo(page, predicate, steps, { reverse = false, limit = 120 } = {}) {
  for (let index = 0; index < limit; index++) {
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
    const focus = await active(page);
    steps.push({ key: reverse ? 'Shift+Tab' : 'Tab', focus });
    if (predicate(focus)) return focus;
  }
  throw new Error(`Keyboard traversal did not find its target. Last focus: ${JSON.stringify(await active(page))}`);
}

async function journeyFor(name, viewport, port) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', hasTouch: name === 'mobile' });
  const page = await context.newPage();
  const errors = [];
  const steps = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/immersive/?keyboard=${name}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('#intro')?.hidden, { timeout: 10000 });

  const introInitialFocus = await active(page);
  const introStops = [];
  await tabTo(page, focus => focus.id === 'skip-intro', introStops);
  const backgroundInteractiveFocusWhileIntroOpen = introStops.filter(item => !item.focus.inIntro && item.focus.tag !== 'body').map(item => item.focus);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'skip-intro' });
  await page.waitForFunction(() => window.immersive?.world, { timeout: 30000 });
  await page.waitForFunction(() => window.immersive.world.getRenderState().renderedFrames > 0, { timeout: 10000 });
  const focusAfterIntro = await active(page);
  const ids = await page.evaluate(() => {
    const articleFor = islandId => window.immersive.data.islands.find(island => island.id === islandId).articleId;
    const titleFor = articleId => window.immersive.data.articles.find(article => article.id === articleId).title;
    const p01 = articleFor('P01'), p04 = articleFor('P04'), i01 = articleFor('I01');
    return { p01, p04, i01, p01Title: titleFor(p01), i01Title: titleFor(i01) };
  });

  await tabTo(page, focus => focus.id === 'hide-explore-tip', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'dismiss-explore-tip' });
  await page.waitForFunction(() => document.querySelector('#explore-tip')?.hidden);

  await tabTo(page, focus => focus.id === 'settings-toggle', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'open-settings' });
  await tabTo(page, focus => focus.id === 'motion', steps);
  await page.keyboard.press('Space');
  steps.push({ key: 'Space', action: 'enable-reduced-motion' });
  await page.waitForFunction(() => document.querySelector('#motion')?.checked && window.immersive.world.getState().reducedMotion);
  await tabTo(page, focus => focus.id === 'settings-toggle', steps, { reverse: true });
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'close-settings' });
  await page.waitForFunction(() => document.querySelector('#settings')?.hidden);

  const mode = await tabTo(page, focus => focus.id === 'mode', steps, { reverse: true });
  const map = await tabTo(page, focus => focus.id === 'map-toggle', steps, { reverse: true });
  const brand = await tabTo(page, focus => focus.className.split(/\s+/).includes('brand'), steps, { reverse: true });
  await page.keyboard.press('Tab');
  const restoredMapFocus = await active(page);
  steps.push({ key: 'Tab', focus: restoredMapFocus });
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'open-catalog' });
  assert.equal(await page.locator('#catalog').isVisible(), true, `${name}: directory did not open from its keyboard control`);
  await page.screenshot({ path: `${output}/${viewport.width}-directory.png` });

  const title = await page.evaluate(id => window.immersive.data.articles.find(article => article.id === id).title, ids.p01);
  const search = await tabTo(page, focus => focus.id === 'search', steps);
  await page.keyboard.type(title);
  await page.waitForFunction(value => document.querySelector('#article-list')?.innerText.includes(value), title, { timeout: 5000 });
  const firstArticle = await tabTo(page, focus => focus.inCatalog && focus.tag === 'button' && focus.text.includes('P01'), steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'open-first-article' });
  await page.waitForFunction(() => document.querySelector('#catalog')?.hidden && document.querySelector('#island-title')?.textContent);
  const selectedArticle = await page.locator('#chapter-label').innerText();
  await page.screenshot({ path: `${output}/${viewport.width}-article.png` });

  await tabTo(page, focus => focus.id === 'read', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'open-reader' });
  await page.waitForFunction(() => document.querySelector('#reader')?.open);
  await page.screenshot({ path: `${output}/${viewport.width}-reader.png` });
  const readerFocusOnOpen = await active(page);
  const fullTab = await tabTo(page, focus => focus.depth === 'full', steps);
  await page.keyboard.press('Space');
  steps.push({ key: 'Space', action: 'show-full-text' });
  await page.waitForFunction(() => document.querySelector('[data-depth="full"]')?.getAttribute('aria-pressed') === 'true');
  const fullTextLength = await page.locator('#reading-content').innerText().then(value => value.length);
  const textFocus = await tabTo(page, focus => focus.id === 'reading-content', steps);
  const readScrollMetrics = () => page.evaluate(() => {
    const dialog = document.querySelector('#reader');
    const content = document.querySelector('#reading-content');
    const viewport = dialog.getBoundingClientRect();
    const textViewportTop = content.getBoundingClientRect().top;
    const visibleParagraphs = [...content.querySelectorAll('p')].map((paragraph, index) => ({ index, text: paragraph.textContent, rect: paragraph.getBoundingClientRect() })).filter(({ rect }) => rect.bottom > Math.max(viewport.top, textViewportTop) && rect.top < viewport.bottom).map(({ index, text }) => ({ index, text: text.slice(0, 120) }));
    return { dialog: { scrollTop: dialog.scrollTop, scrollHeight: dialog.scrollHeight, clientHeight: dialog.clientHeight, overflowY: getComputedStyle(dialog).overflowY }, content: { scrollTop: content.scrollTop, scrollHeight: content.scrollHeight, clientHeight: content.clientHeight, paragraphCount: content.querySelectorAll('p').length }, window: scrollY, visibleParagraphs };
  });
  const readerScrollBefore = await readScrollMetrics();
  const pageDownSteps = [];
  let readerScroll = readerScrollBefore;
  while (readerScroll.dialog.scrollTop < (readerScroll.dialog.scrollHeight - readerScroll.dialog.clientHeight) / 3 && pageDownSteps.length < 10) {
    const before = readerScroll.dialog.scrollTop;
    const minDelta = Math.min(readerScroll.dialog.clientHeight / 2, readerScroll.dialog.scrollHeight - before);
    await page.keyboard.press('PageDown');
    steps.push({ key: 'PageDown', action: 'scroll-original-text', page: pageDownSteps.length + 1 });
    await page.waitForFunction(({ start, delta }) => document.querySelector('#reader').scrollTop >= start + delta, { start: before, delta: minDelta }, { timeout: 2000 });
    readerScroll = await readScrollMetrics();
    pageDownSteps.push({ scrollTop: readerScroll.dialog.scrollTop, firstVisibleParagraph: readerScroll.visibleParagraphs[0]?.index ?? null, visibleParagraphs: readerScroll.visibleParagraphs.map(paragraph => paragraph.index) });
  }
  await page.screenshot({ path: `${output}/${viewport.width}-reader-page-down.png` });
  await tabTo(page, focus => focus.id === 'note', steps);
  await page.keyboard.type(`keyboard-note-${name}`);
  await page.waitForFunction(value => document.querySelector('#note-status')?.textContent.includes('已儲存'), undefined, { timeout: 5000 });
  await page.keyboard.press('Escape');
  steps.push({ key: 'Escape', action: 'close-reader' });
  await page.waitForFunction(() => !document.querySelector('#reader')?.open);
  const readerCloseFocus = await active(page);

  await tabTo(page, focus => focus.id === 'interact', steps);
  const interactLabel = (await active(page)).text;
  await page.keyboard.press('Space');
  steps.push({ key: 'Space', action: 'open-island-task' });
  await page.waitForFunction(() => document.querySelector('#game')?.open);
  const characterDialogue = await page.evaluate(id => {
    const scene = window.immersive.data.scenes.find(scene => scene.articleId === id);
    return { scene, gameIntro: document.querySelector('#game-intro').textContent, gameTitle: document.querySelector('#game-title').textContent };
  }, ids.p01);
  const dialogueState = await page.evaluate(() => ({
    visible: document.querySelector('#game-dialogue')?.textContent || '',
    fictional: document.querySelector('#game .eyebrow')?.textContent || '',
    world: window.immersive.world.getState(),
  }));
  await page.screenshot({ path: `${output}/${viewport.width}-character-dialogue.png` });
  const gameKind = await page.evaluate(id => window.immersive.data.scenes.find(scene => scene.articleId === id).interactionType, ids.p01);
  if (gameKind === 'sourceverification') {
    await tabTo(page, focus => focus.inGame && focus.tag === 'button' && focus.text.startsWith('核對：'), steps);
    await page.keyboard.press('Enter');
    steps.push({ key: 'Enter', action: 'inspect-source-clue' });
    await tabTo(page, focus => focus.inGame && focus.tag === 'button' && focus.text.includes('保留待查'), steps);
    await page.keyboard.press('Enter');
    steps.push({ key: 'Enter', action: 'complete-source-task' });
  } else {
    await tabTo(page, focus => focus.inGame && focus.tag === 'button' && !focus.text.includes('關閉'), steps);
    await page.keyboard.press('Enter');
    steps.push({ key: 'Enter', action: 'complete-first-task-choice' });
  }
  await page.waitForFunction(() => !document.querySelector('#game-after')?.hidden, { timeout: 5000 });
  const taskImpact = await page.locator('#game-impact').innerText();
  await tabTo(page, focus => focus.inGame && focus.tag === 'summary' && focus.text.includes('完整結果'), steps);
  const fullResultFocus = await active(page);
  await page.keyboard.press('Space');
  steps.push({ key: 'Space', action: 'expand-full-task-result' });
  await page.waitForFunction(() => document.querySelector('#game-full-result')?.open);
  const taskResult = await page.locator('#game-result').innerText();
  const fullTaskResultVisible = await page.locator('#game-result').isVisible();
  await page.screenshot({ path: `${output}/${viewport.width}-task-result.png` });
  await page.keyboard.press('Escape');
  steps.push({ key: 'Escape', action: 'close-task' });
  await page.waitForFunction(() => !document.querySelector('#game')?.open);
  await page.waitForFunction(() => window.immersive.world.getState().encounter === null && window.immersive.world.getState().speech === '', { timeout: 2000 });
  const taskCloseFocus = await active(page);
  const conversationAfterClose = await page.evaluate(() => window.immersive.world.getState());

  await tabTo(page, focus => focus.id === 'read', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'reopen-reader-for-recommendations' });
  await page.waitForFunction(() => document.querySelector('#reader')?.open);
  await tabTo(page, focus => focus.inReader && focus.tag === 'textarea', steps);
  const savedNote = await page.locator('#note').inputValue();
  assert.equal(savedNote, `keyboard-note-${name}`, `${name}: note was lost after closing and reopening the reader`);
  const recommendedTitle = await page.evaluate(id => {
    const target = window.immersive.data.islands.find(island => island.id === 'P04');
    return window.immersive.data.articles.find(article => article.id === target.articleId).title;
  }, ids.p04);
  await tabTo(page, focus => focus.inReader && focus.tag === 'button' && focus.text.includes(recommendedTitle), steps);
  const recommendation = await active(page);
  const recommendationBox = await page.evaluate(() => {
    const button = [...document.querySelectorAll('#recommendations button')].find(element => element.matches(':focus'));
    const rect = button.getBoundingClientRect();
    const reader = document.querySelector('#reader').getBoundingClientRect();
    return { button: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, reader: { y: reader.y, height: reader.height }, viewportHeight: innerHeight };
  });
  await page.screenshot({ path: `${output}/${viewport.width}-recommendation-before.png` });
  if (name === 'mobile') {
    await page.keyboard.press('Enter');
    steps.push({ key: 'Enter', action: 'follow-recommendation' });
  } else {
    await page.keyboard.press('Enter');
    steps.push({ key: 'Enter', action: 'follow-recommendation' });
  }
  await page.waitForFunction(() => !document.querySelector('#reader')?.open && document.querySelector('#return-source')?.hidden === false, { timeout: 10000 });
  const destination = await page.evaluate(() => window.immersive.world.getState().current);
  const returnSourceText = await page.locator('#return-source').innerText();
  await page.screenshot({ path: `${output}/${viewport.width}-destination.png` });
  await tabTo(page, focus => focus.id === 'return-source', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'return-to-source' });
  await page.waitForFunction(id => window.immersive.world.getState().current === id, ids.p01, { timeout: 10000 });
  const returnedTitle = await page.locator('#island-title').innerText();
  const returnAfterReturningToRecommendationSource = await page.locator('#return-source').innerText();

  await tabTo(page, focus => focus.id === 'read', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'verify-note-after-return' });
  await page.waitForFunction(() => document.querySelector('#reader')?.open);
  const noteAfterReturn = await page.locator('#note').inputValue();
  await page.keyboard.press('Escape');
  steps.push({ key: 'Escape', action: 'close-reader-after-note-check' });
  await page.waitForFunction(() => !document.querySelector('#reader')?.open);

  await tabTo(page, focus => focus.id === 'read', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'reopen-reader-for-touch-check' });
  await page.waitForFunction(() => document.querySelector('#reader')?.open);
  await tabTo(page, focus => focus.inReader && focus.tag === 'button' && focus.text.includes(recommendedTitle), steps);
  const tapStartBox = await page.evaluate(() => {
    const button = document.activeElement;
    const rect = button.getBoundingClientRect();
    const evidence = [];
    window.__keyboardRecommendationTap = evidence;
    for (const type of ['pointerdown', 'click']) button.addEventListener(type, event => {
      const current = button.getBoundingClientRect();
      evidence.push({ type, pointerType: event.pointerType || '', x: current.x, y: current.y, width: current.width, height: current.height, clientX: event.clientX, clientY: event.clientY });
    }, { capture: true });
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  let tapEvidence = [];
  if (name === 'mobile') {
    await page.touchscreen.tap(tapStartBox.x + tapStartBox.width / 2, tapStartBox.y + tapStartBox.height / 2);
    tapEvidence = await page.evaluate(() => window.__keyboardRecommendationTap);
    steps.push({ input: 'touchscreen.tap', action: 'follow-recommendation' });
  } else {
    await page.keyboard.press('Enter');
    steps.push({ key: 'Enter', action: 'follow-recommendation-again' });
  }
  await page.waitForFunction(() => !document.querySelector('#reader')?.open && document.querySelector('#return-source')?.hidden === false, { timeout: 10000 });
  const secondDestination = await page.evaluate(() => window.immersive.world.getState().current);
  await tabTo(page, focus => focus.id === 'return-source', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'return-after-touch-check' });
  await page.waitForFunction(id => window.immersive.world.getState().current === id, ids.p01, { timeout: 10000 });
  const returnAfterTouch = await page.locator('#return-source').innerText();

  await tabTo(page, focus => focus.id === 'return-source', steps);
  await page.keyboard.press('Enter');
  steps.push({ key: 'Enter', action: 'return-to-previous-history' });
  await page.waitForFunction(id => window.immersive.world.getState().current === id, ids.i01, { timeout: 10000 });
  const historyReturnTitle = await page.locator('#island-title').innerText();

  await page.screenshot({ path: `${output}/${viewport.width}-returned.png` });

  assert.equal(await page.evaluate(() => window.immersive.world.getState().reducedMotion), true, `${name}: reduced motion was not enabled`);
  assert.equal(destination, ids.p04, `${name}: expected recommendation path P01 to P04`);
  assert.equal(secondDestination, ids.p04, `${name}: second recommendation path P01 to P04 failed`);
  assert.match(returnSourceText, /P01/, `${name}: source return label missing P01`);
  assert.equal(returnedTitle, ids.p01Title, `${name}: recommendation return did not restore P01`);
  assert.match(returnAfterReturningToRecommendationSource, /I01/, `${name}: previous history entry was lost after returning to P01`);
  assert.match(returnAfterTouch, /I01/, `${name}: history return changed after the second recommendation`);
  assert.equal(historyReturnTitle, ids.i01Title, `${name}: previous history return did not restore I01`);
  assert.equal(noteAfterReturn, `keyboard-note-${name}`, `${name}: note was lost after returning from recommendation`);
  assert.match(selectedArticle, /P01/, `${name}: directory did not open P01`);
  assert.ok(fullTextLength > 1000, `${name}: full text did not load`);
  assert.ok(readerScroll.dialog.scrollTop >= (readerScroll.dialog.scrollHeight - readerScroll.dialog.clientHeight) / 3, `${name}: PageDown did not reach the middle of the reader dialog scrollport`);
  assert.ok(readerScroll.visibleParagraphs.some(paragraph => paragraph.index >= Math.floor(readerScroll.content.paragraphCount / 3)), `${name}: PageDown did not expose a middle article paragraph`);
  assert.ok(taskResult.length > 30, `${name}: task result is missing`);
  assert.ok(taskImpact.length > 0, `${name}: task outcome was not announced in the dialog`);
  assert.equal(fullTaskResultVisible, true, `${name}: keyboard could not reveal the full task result`);
  assert.equal(textFocus.outline, 'solid', `${name}: focused original text has no visible outline`);
  assert.equal(errors.length, 0, `${name}: page errors: ${errors.join('\n')}`);

  const protagonistLine = characterDialogue.scene.dialogue.find(line => line.characterId === characterDialogue.scene.protagonistId)?.text;
  const protagonistName = await page.evaluate(id => window.immersive.data.characters.find(character => character.id === id).name, characterDialogue.scene.protagonistId);
  assert.equal(focusAfterIntro.id, 'map-toggle', `${name}: intro did not return focus to the directory control`);
  assert.equal(backgroundInteractiveFocusWhileIntroOpen.length, 0, `${name}: Tab reached an interactive element behind the intro cover: ${JSON.stringify({ initial: introInitialFocus, stops: introStops.map(item => item.focus) })}`);
  assert.equal(restoredMapFocus.outline, 'solid', `${name}: keyboard focus is not visibly outlined`);
  assert.equal(dialogueState.visible, `${protagonistName}：「${protagonistLine}」`, `${name}: current character dialogue was not exposed in the native interaction dialog`);
  assert.equal(dialogueState.fictional.includes('虛構人物'), true, `${name}: character dialogue does not identify the fictional scene`);
  assert.equal(dialogueState.world.encounter?.characterId, characterDialogue.scene.protagonistId, `${name}: keyboard task entry did not engage the main character`);
  assert.equal(dialogueState.world.speech, protagonistLine, `${name}: character dialogue did not reach the 3D conversation`);
  assert.equal(taskCloseFocus.id, 'interact', `${name}: closing the task dialog did not return focus to its opener`);
  assert.equal(conversationAfterClose.encounter, null, `${name}: closing the task dialog did not clear the conversation`);
  assert.equal(conversationAfterClose.speech, '', `${name}: closing the task dialog did not clear the character speech`);
  assert.equal(readerCloseFocus.id, 'read', `${name}: closing the reader did not return focus to its opener`);
  if (name === 'mobile') {
    const pointerdown = tapEvidence.find(event => event.type === 'pointerdown');
    const touchClick = tapEvidence.find(event => event.type === 'click');
    assert.ok(pointerdown, `${name}: recommendation was not activated by a real touch event`);
    assert.equal(pointerdown.pointerType, 'touch', `${name}: recommendation activation used a non-touch pointer`);
    assert.ok(touchClick, `${name}: touch did not activate the recommendation`);
    assert.ok(tapStartBox.height >= 44, `${name}: recommendation target is too short for touch`);
    assert.deepEqual({ width: pointerdown.width, height: pointerdown.height }, { width: tapStartBox.width, height: tapStartBox.height }, `${name}: recommendation target resized as the touch began`);
    assert.deepEqual({ width: touchClick.width, height: touchClick.height }, { width: tapStartBox.width, height: tapStartBox.height }, `${name}: recommendation target resized before touch activation`);
    assert.ok(recommendationBox.reader.height <= recommendationBox.viewportHeight * 0.58 + 1, `${name}: reader exceeded the 58dvh cap`);
    assert.ok(recommendationBox.button.height >= 44, `${name}: keyboard recommendation target is too short for touch`);
  }

  const result = {
    name,
    viewport,
    introFocus: { initial: introInitialFocus, stopsBeforeSkip: introStops.map(item => item.focus), backgroundInteractiveFocusWhileIntroOpen, focusAfterIntro },
    navigation: { ids, brand, mode, map, restoredMapFocus, search, firstArticle, selectedArticle, destination, returnSourceText, returnedTitle, returnAfterReturningToRecommendationSource, returnAfterTouch, historyReturnTitle },
    reader: { readerFocusOnOpen, fullTab, textFocus, fullTextLength, readerScrollBefore, pageDownSteps, readerScroll, savedNote, noteAfterReturn },
    interaction: { interactLabel, characterDialogue: { protagonistId: characterDialogue.scene.protagonistId, currentDialogue: characterDialogue.scene.dialogue, gameIntro: characterDialogue.gameIntro, gameTitle: characterDialogue.gameTitle, visible: dialogueState.visible, fictional: dialogueState.fictional, worldEncounter: dialogueState.world.encounter, worldSpeech: dialogueState.world.speech }, taskImpact, fullResultFocus, taskResult, fullTaskResultVisible, taskCloseFocus, conversationAfterClose: { encounter: conversationAfterClose.encounter, speech: conversationAfterClose.speech } },
    recommendationBox,
    tapCheck: { startBox: tapStartBox, events: tapEvidence },
    reducedMotion: true,
    steps,
    errors,
  };
  await context.close();
  return result;
}

try {
  const viewportCases = process.env.KEYBOARD_PATH_VIEWPORT === 'mobile'
    ? [['mobile', { width: 390, height: 844 }]]
    : [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]];
  for (const [name, viewport] of viewportCases) {
    journeys.push(await journeyFor(name, viewport, server.httpServer.address().port));
    await writeFile(`${output}/results.json`, JSON.stringify({ journeys }, null, 2));
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ journeys }, null, 2));
  console.log(JSON.stringify(journeys.map(({ name, viewport, introFocus, navigation, reader, interaction, recommendationBox, tapCheck, reducedMotion, errors }) => ({
    name,
    viewport,
    introFocus: { initial: introFocus.initial.id, stopsBeforeSkip: introFocus.stopsBeforeSkip.map(focus => focus.id || focus.tag), backgroundInteractiveStops: introFocus.backgroundInteractiveFocusWhileIntroOpen.length, afterClose: introFocus.focusAfterIntro.id },
    navigation: { selectedArticle: navigation.selectedArticle, recommendedDestination: navigation.destination, returnedTitle: navigation.returnedTitle, returnedHistoryTitle: navigation.historyReturnTitle },
    reading: { fullTextLength: reader.fullTextLength, pageDownCount: reader.pageDownSteps.length, startScrollTop: reader.readerScrollBefore.dialog.scrollTop, endScrollTop: reader.readerScroll.dialog.scrollTop, visibleParagraphs: reader.readerScroll.visibleParagraphs.map(paragraph => paragraph.index), savedNote: reader.savedNote, noteAfterReturn: reader.noteAfterReturn },
    interaction: { label: interaction.interactLabel, characterDialogue: interaction.characterDialogue.visible, fictionalLabel: interaction.characterDialogue.fictional, result: interaction.taskResult, closeFocus: interaction.taskCloseFocus.id, conversationAfterClose: interaction.conversationAfterClose },
    recommendationBox,
    tapCheck,
    reducedMotion,
    errors,
  })), null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
