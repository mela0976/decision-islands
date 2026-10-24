import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

test('mission phase feedback tracks only the current choice and preview', async () => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false } });
  await server.listen();
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    await page.route(`${origin}/__mission_feedback_fixture`, route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><main id="fixture" style="width:318px"></main></body></html>'}));
    await page.goto(`${origin}/__mission_feedback_fixture`);
    await page.evaluate(async () => {
      const {createMissionStage} = await import('/src/mission-stage.ts');
      const text = value => ({zh:value,en:value});
      const frame = x => ({description:text(`人物移動到 ${x}`),entities:[{id:'person',kind:'adult',x,y:75,pose:'work'},{id:'assistant',kind:'robot',x:70,y:75,pose:'listen'},{id:'phone',kind:'phone',x:50,y:65}],flows:[{id:'review',from:'person',to:'assistant',kind:'review'}]});
      window.definition = {setting:'home',title:text('家庭情境'),initial:frame(25),choices:{a:frame(55),b:frame(35)}};
      window.input = {key:'family',definition:window.definition,choiceId:null,previewChoiceId:null};
      window.stage = createMissionStage(document.querySelector('#fixture'),'zh');
      window.stage.update(window.input);
    });
    await page.locator('.mission-stage-canvas').waitFor();
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'ready');
    assert.equal(await page.locator('.mission-stage-phase').isHidden(),true,'ready does not show phase chips');

    await page.evaluate(() => {window.input = {...window.input,choiceId:'b'}; window.stage.update(window.input);});
    const phases = page.locator('.mission-stage-phase');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'approach');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'after');
    assert.equal(await page.locator('.mission-stage-comparison').isVisible(),false,'comparison controls stay hidden during playback');
    assert.deepEqual(await phases.locator('li').allTextContents(),['準備','操作','結果']);
    assert.equal(await phases.locator('[aria-current="step"]').textContent(),'準備');
    const layout = await page.evaluate(() => {
      const phase = document.querySelector('.mission-stage-phase').getBoundingClientRect();
      const replay = document.querySelector('.mission-stage-replay').getBoundingClientRect();
      return {phaseBottom:phase.bottom,phaseRight:phase.right,replayLeft:replay.left};
    });
    assert.ok(layout.phaseBottom <= 40,`phase chips stay in the top overlay band: ${JSON.stringify(layout)}`);
    assert.ok(layout.phaseRight < layout.replayLeft,`phase chips do not overlap replay: ${JSON.stringify(layout)}`);

    await page.locator('.mission-stage-canvas').evaluate(canvas => {
      canvas.dispatchEvent(new CustomEvent('mission-stage-phase',{bubbles:true,detail:{phase:'result',choiceId:'a',preview:false}}));
      canvas.dispatchEvent(new CustomEvent('mission-stage-phase',{bubbles:true,detail:{phase:'result',choiceId:'b',preview:true}}));
    });
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'approach','stale and preview-mismatched events cannot replace the selected phase');

    await page.clock.fastForward(3000);
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'result');
    const comparison = page.locator('.mission-stage-comparison');
    assert.equal(await comparison.isVisible(),true,'comparison controls replace phase chips after the result');
    assert.deepEqual(await comparison.locator('button').allTextContents(),['選擇前','選擇後']);
    const controls = await page.evaluate(() => {
      const group = document.querySelector('.mission-stage-comparison').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.mission-stage-comparison button')].map(button => button.getBoundingClientRect());
      const replay = document.querySelector('.mission-stage-replay').getBoundingClientRect();
      return {group,buttons,replay};
    });
    assert.ok(controls.buttons.every(button => button.height >= 44),'comparison buttons meet the 44px touch target minimum');
    assert.ok(controls.group.bottom <= 54,'comparison controls fit the reserved top strip');
    assert.ok(controls.group.right < controls.replay.left,`comparison controls do not overlap replay at 318px: ${JSON.stringify(controls)}`);

    const before = comparison.locator('[data-mission-view="before"]');
    const after = comparison.locator('[data-mission-view="after"]');
    await before.click();
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'before');
    assert.equal(await before.getAttribute('aria-pressed'),'true');
    assert.equal(await after.getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'ready');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-cue-active'),'true');
    assert.deepEqual(await page.locator('.mission-stage-change-cue [data-change-cue-label]').allTextContents(),['人物位置改變']);
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-cue-active'),'false','hiding the WebGL stage clears the cue immediately');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-cue-ids'),null);
    assert.match(await page.locator('.mission-stage--3d figcaption').textContent(),/選擇前：人物移動到 25/);
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});});
    assert.match(await page.locator('.mission-stage--3d figcaption').textContent(),/選擇前：人物移動到 25/);
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-choice-id'),'b');
    assert.deepEqual(await page.evaluate(() => ({choiceId:window.input.choiceId,previewChoiceId:window.input.previewChoiceId})),{choiceId:'b',previewChoiceId:null});
    await page.locator('.mission-stage-canvas').evaluate(canvas => {
      canvas.dispatchEvent(new CustomEvent('mission-stage-phase',{bubbles:true,detail:{phase:'result',choiceId:'b',preview:false,comparisonView:'after'}}));
    });
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'ready','late phase events cannot replace the before view state');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'before');
    await after.click();
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'after');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'result');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-cue-active'),'true');
    await page.clock.fastForward(2300);
    assert.match(await page.locator('.mission-stage--3d figcaption').textContent(),/你選的做法：人物移動到 35/);

    await before.click();
    await page.evaluate(() => {window.input = {...window.input,key:'family-next'}; window.stage.update(window.input);});
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'after','a changed mission resets the view');
    assert.equal(await after.getAttribute('aria-pressed'),'true');
    await page.evaluate(() => {window.input = {...window.input,key:'family',choiceId:'a'}; window.stage.update(window.input);});
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'after','a changed choice resets the view');
    await page.clock.fastForward(3000);

    await page.evaluate(() => {window.input = {...window.input,previewChoiceId:'b'}; window.stage.update(window.input);});
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'after','a changed preview resets the view');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'approach');
    assert.match(await page.locator('.mission-stage figcaption').textContent(),/^另一種做法（預覽）：/);
    await page.locator('.mission-stage-canvas').evaluate(canvas => {
      canvas.dispatchEvent(new CustomEvent('mission-stage-phase',{bubbles:true,detail:{phase:'result',choiceId:'b',preview:false}}));
      canvas.dispatchEvent(new CustomEvent('mission-stage-phase',{bubbles:true,detail:{phase:'result',choiceId:'b',preview:true}}));
    });
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'result');
    assert.equal(await phases.locator('[aria-current="step"]').textContent(),'結果');
    assert.match(await page.locator('.mission-stage figcaption').textContent(),/人物移動到 35/);

    await page.clock.fastForward(3000);
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'result','the engine keeps the result phase after its animation');
    await before.click();
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-cue-active'),'true');
    await page.clock.fastForward(2300);
    assert.match(await page.locator('.mission-stage--3d figcaption').textContent(),/選擇前（預覽）：人物移動到 25/);
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-choice-id'),'b');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-preview'),'true');
    await page.locator('.mission-stage-replay').evaluate(button => button.click());
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-comparison-view'),'after','replay switches from before to after');
    assert.equal(await after.getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.mission-stage--3d').getAttribute('data-phase'),'approach','replay returns the indicator to the first phase');
    assert.deepEqual(await page.evaluate(() => ({choiceId:window.input.choiceId,previewChoiceId:window.input.previewChoiceId})),{choiceId:'a',previewChoiceId:'b'});
    await page.clock.fastForward(3000);
    await page.evaluate(() => window.stage.setMotion(false));
    assert.equal(await page.locator('.mission-stage-replay').isDisabled(),true,'replay remains unavailable while motion is paused');
    assert.equal(await comparison.isVisible(),true,'the comparison remains available while motion is paused');
    await page.evaluate(() => window.stage.setMotion(true));
    await page.evaluate(() => window.stage.dispose());
    assert.equal(await page.locator('.mission-stage').count(),0);
  } finally {
    await browser.close();
    await server.close();
  }
});

test('SVG fallback keeps the existing preview caption without phase chips', async () => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false } });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return String(kind).includes('webgl') ? null : getContext.call(this, kind, ...args); };
    });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    await page.route(`${origin}/__mission_fallback_fixture`, route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><main id="fixture" style="width:320px"></main></body></html>'}));
    await page.goto(`${origin}/__mission_fallback_fixture`);
    await page.evaluate(async () => {
      const {createMissionStage} = await import('/src/mission-stage.ts');
      const text = value => ({zh:value,en:value});
      const frame = x => ({description:text(`人物移動到 ${x}`),entities:[{id:'person',kind:'adult',x,y:75}],flows:[]});
      const definition = {setting:'home',title:text('家庭情境'),initial:frame(25),choices:{a:frame(55),b:frame(35)}};
      window.stage = createMissionStage(document.querySelector('#fixture'),'zh');
      window.stage.update({key:'family',definition,choiceId:'b',previewChoiceId:'a'});
    });
    await page.locator('.mission-stage[data-renderer="fallback"] svg').waitFor();
    const fallback = page.locator('.mission-stage[data-renderer="fallback"]');
    const comparison = fallback.locator('.mission-stage-comparison');
    assert.equal(await page.locator('.mission-stage-phase').count(),0);
    assert.equal(await comparison.isVisible(),true,'fallback exposes the shared comparison controls');
    assert.match(await page.locator('.mission-stage figcaption').textContent(),/預覽/);
    assert.match(await page.locator('.mission-stage figcaption').textContent(),/人物移動到 55/);
    assert.equal(await fallback.getAttribute('data-choice-id'),'a');
    assert.equal(await fallback.getAttribute('data-preview'),'true');
    const before = comparison.locator('[data-mission-view="before"]');
    const after = comparison.locator('[data-mission-view="after"]');
    await before.click();
    assert.equal(await fallback.getAttribute('data-comparison-view'),'before');
    assert.equal(await before.getAttribute('aria-pressed'),'true');
    assert.equal(await fallback.getAttribute('data-choice-id'),'a','before view keeps the preview choice metadata');
    assert.equal(await fallback.getAttribute('data-preview'),'true');
    assert.equal(await fallback.getAttribute('data-cue-active'),'true');
    assert.equal(await fallback.locator('.mission-stage-change-cue-context').textContent(),'預覽');
    await page.clock.fastForward(2300);
    assert.match(await fallback.locator('figcaption').textContent(),/選擇前（預覽）：人物移動到 25/);
    assert.equal(await fallback.locator('[data-scene-entity="person"]').getAttribute('data-x'),'25');
    await after.click();
    assert.equal(await fallback.getAttribute('data-comparison-view'),'after');
    assert.equal(await after.getAttribute('aria-pressed'),'true');
    assert.equal(await fallback.locator('[data-scene-entity="person"]').getAttribute('data-x'),'55');
    const controls = await page.evaluate(() => {
      const group = document.querySelector('.mission-stage-comparison').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.mission-stage-comparison button')].map(button => button.getBoundingClientRect());
      const replay = document.querySelector('.mission-stage-replay').getBoundingClientRect();
      return {group,buttons,replay};
    });
    assert.ok(controls.buttons.every(button => button.height >= 44));
    assert.ok(controls.group.right < controls.replay.left,`fallback comparison controls do not overlap replay at 320px: ${JSON.stringify(controls)}`);
    await before.click();
    await fallback.locator('.mission-stage-replay').click();
    assert.equal(await fallback.getAttribute('data-cue-active'),'false','replay clears the active cue');
    assert.equal(await fallback.getAttribute('data-comparison-view'),'after','fallback replay switches to after');
    assert.equal(await after.getAttribute('aria-pressed'),'true');
    assert.equal(await fallback.getAttribute('data-choice-id'),'a');
    assert.equal(await fallback.getAttribute('data-preview'),'true');
    assert.equal(await fallback.getAttribute('data-animating'),'true','fallback replay animates the selected result');
    await page.clock.fastForward(1500);
    await page.evaluate(async () => { document.getAnimations().forEach(animation => animation.finish()); await Promise.resolve(); });
    assert.equal(await fallback.getAttribute('data-animating'),'false');
    await page.evaluate(() => window.stage.dispose());
  } finally {
    await browser.close();
    await server.close();
  }
});

test('manual comparison cues identify only changed entities, renew once, and clear on lifecycle changes', {timeout: 30000}, async () => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false } });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return String(kind).includes('webgl') ? null : getContext.call(this, kind, ...args); };
    });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    await page.route(`${origin}/__mission_cue_fixture`, route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><main id="fixture" style="width:318px"></main><main id="english-fixture" style="width:318px"></main></body></html>'}));
    await page.goto(`${origin}/__mission_cue_fixture`);
    await page.evaluate(async () => {
      const {createMissionStage} = await import('/src/mission-stage.ts');
      const text = value => ({zh:value,en:value});
      const frame = (x, phoneX) => ({description:text(`人物移動到 ${x}`),entities:[{id:'person',kind:'adult',x,y:75},{id:'phone',kind:'phone',x:phoneX,y:65}],flows:[]});
      const definition = {setting:'home',title:text('家庭情境'),initial:frame(25,50),choices:{a:frame(25,50),b:frame(35,42)}};
      window.input = {key:'family',definition,choiceId:null,previewChoiceId:null};
      window.stage = createMissionStage(document.querySelector('#fixture'),'zh');
      window.stage.update(window.input);
    });
    const figure = page.locator('.mission-stage[data-renderer="fallback"]');
    await figure.locator('svg').waitFor();
    const buttons = figure.locator('.mission-stage-comparison');
    assert.equal(await figure.getAttribute('data-cue-active'),'false','no initial choice creates a cue');
    assert.equal(await figure.locator('.mission-stage-change-cue').count(),0);

    await page.evaluate(() => {window.input = {...window.input,choiceId:'b'}; window.stage.update(window.input);});
    assert.equal(await figure.getAttribute('data-cue-active'),'false','choosing a result alone does not create a cue');
    await page.evaluate(() => {window.input = {...window.input,previewChoiceId:'b'}; window.stage.update(window.input);});
    assert.equal(await figure.getAttribute('data-cue-active'),'false','preview changes alone do not create a cue');
    const stableInput = await page.evaluate(() => JSON.stringify(window.input));

    const before = buttons.locator('[data-mission-view="before"]');
    const after = buttons.locator('[data-mission-view="after"]');
    await before.click();
    assert.equal(await figure.getAttribute('data-cue-active'),'true');
    assert.equal(await figure.locator('.mission-stage-change-cue-context').textContent(),'預覽');
    assert.deepEqual(await figure.locator('.mission-stage-change-cue [data-change-cue-label]').allTextContents(),['人物位置改變','道具位置改變']);
    assert.deepEqual(JSON.parse(await figure.getAttribute('data-cue-ids')),['person','phone']);
    assert.equal(await page.evaluate(() => JSON.stringify(window.input)),stableInput,'manual view changes do not mutate choice or preview metadata');
    const activeToken = Number(await figure.getAttribute('data-cue-token'));
    const layout = await figure.locator('figcaption').evaluate(caption => {
      const region = caption.querySelector('.mission-stage-change-cue');
      const box = caption.getBoundingClientRect();
      const scene = caption.parentElement.querySelector('svg').getBoundingClientRect();
      const controls = caption.parentElement.querySelector('.mission-stage-comparison').getBoundingClientRect();
      const labels = [...region.querySelectorAll('[data-change-cue-label]')].map(node => {
        const rect = node.getBoundingClientRect();
        return {fontSize:parseFloat(getComputedStyle(node).fontSize),width:node.clientWidth,scrollWidth:node.scrollWidth,left:rect.left,right:rect.right};
      });
      return {box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},region:region.getBoundingClientRect().toJSON(),scene:{top:scene.top,bottom:scene.bottom},controls:{top:controls.top,bottom:controls.bottom},labels};
    });
    assert.ok(layout.labels.length <= 2);
    assert.ok(layout.labels.every(label => label.fontSize >= 12 && label.scrollWidth <= label.width),`cue labels fit at 318px: ${JSON.stringify(layout)}`);
    assert.ok(layout.labels.every(label => label.left >= layout.box.left && label.right <= layout.box.right),`cue chips stay inside the caption: ${JSON.stringify(layout)}`);
    assert.ok(layout.region.top >= layout.scene.bottom && layout.region.top >= layout.controls.bottom,`cue chips do not overlap characters or comparison controls: ${JSON.stringify(layout)}`);
    assert.equal(await figure.locator('[data-scene-entity="person"] > use').evaluate(node => getComputedStyle(node).filter.includes('drop-shadow')),true,'changed fallback entities receive a static visual highlight');

    await page.clock.fastForward(1700);
    await before.click();
    assert.equal(Number(await figure.getAttribute('data-cue-token')),activeToken,'pressing the selected view does not restart the cue');
    await page.clock.fastForward(500);
    assert.equal(await figure.getAttribute('data-cue-active'),'false','the cue expires after 2200ms from its original toggle');
    assert.equal(await figure.locator('[data-scene-entity="person"] > use').evaluate(node => getComputedStyle(node).filter.includes('drop-shadow')),false,'expiry removes the SVG highlight');
    assert.match(await figure.locator('figcaption').textContent(),/選擇前（預覽）：人物移動到 25/,'expiry restores the existing preview caption');
    assert.equal(await figure.getAttribute('data-cue-ids'),null);

    await after.click();
    const afterFirstFlip = Number(await figure.getAttribute('data-cue-token'));
    await page.clock.fastForward(1700);
    await before.click();
    assert.equal(Number(await figure.getAttribute('data-cue-token')),afterFirstFlip + 1,'a rapid real toggle starts a fresh token');
    await page.clock.fastForward(500);
    assert.equal(await figure.getAttribute('data-cue-active'),'true','the prior timer cannot clear a renewed cue');
    await page.clock.fastForward(1700);
    assert.equal(await figure.getAttribute('data-cue-active'),'false');

    await after.click();
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await figure.getAttribute('data-cue-active'),'false','hiding the page immediately clears the cue');
    assert.equal(await figure.getAttribute('data-cue-ids'),null);
    assert.match(await figure.locator('figcaption').textContent(),/預覽/);
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});});

    await page.emulateMedia({reducedMotion:'reduce'});
    await before.click();
    assert.equal(await figure.getAttribute('data-cue-active'),'true','the static cue remains visible with reduced motion enabled');
    assert.equal(await figure.locator('[data-scene-entity="person"] > use').evaluate(node => getComputedStyle(node).animationName),'none');
    await page.evaluate(() => {window.stage.setMotion(false); window.stage.setActive(false);});
    assert.equal(await figure.getAttribute('data-cue-active'),'false','deactivation clears the cue and its renderer highlight');
    assert.equal(await figure.getAttribute('data-cue-ids'),null);
    await page.evaluate(() => {window.stage.setActive(true);});
    assert.equal(await figure.getAttribute('data-cue-active'),'false','returning to the stage cannot restore an expired cue');

    await page.evaluate(async () => {
      const {createMissionStage} = await import('/src/mission-stage.ts');
      const text = value => ({zh:value,en:value});
      const frame = x => ({description:text('A person moves'),entities:[{id:'person',kind:'adult',x,y:75}],flows:[]});
      const definition = {setting:'home',title:text('Scene'),initial:frame(25),choices:{a:frame(35)}};
      window.englishStage = createMissionStage(document.querySelector('#english-fixture'),'en');
      window.englishStage.update({key:'english',definition,choiceId:'a',previewChoiceId:null});
    });
    const english = page.locator('#english-fixture .mission-stage[data-renderer="fallback"]');
    await english.locator('svg').waitFor();
    await english.locator('[data-mission-view="before"]').click();
    assert.equal(await english.locator('.mission-stage-change-cue [data-change-cue-label]').first().textContent(),'People change position');
    assert.equal(await page.locator('#english-fixture .mission-stage-cue-announcement').textContent(),'People change position');
    await page.evaluate(() => {window.stage.dispose();window.englishStage.dispose();});
  } finally {
    await browser.close();
    await server.close();
  }
});
