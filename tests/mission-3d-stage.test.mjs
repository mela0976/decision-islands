import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const setup = async (page, origin, language = 'zh') => {
  await page.route(`${origin}/__mission_3d_fixture`, route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#edf0e3"><main id="fixture" style="width:900px;height:450px"></main></body></html>'}));
  await page.goto(`${origin}/__mission_3d_fixture`);
  await page.evaluate(async language => {
    const { createMission3DStage } = await import('/src/mission-3d-stage.ts');
    const text = value => ({zh:value,en:value});
    const frame = (x, pose = 'idle', kind = 'share') => ({description:text(`Action ${x}`),entities:[{id:'person',kind:'adult',x,y:75,pose},{id:'assistant',kind:'robot',x:70,y:75,pose:'listen'},{id:'phone',kind:'phone',x:50,y:60},{id:'stop',kind:'stop',x:58,y:60,opacity:kind==='pause'?1:.15}],flows:x===25?[]:[{id:'transfer',from:'person',to:'assistant',kind}],actions:[{actor:'person',target:kind==='pause'?'stop':'assistant',prop:'phone',kind:kind==='pause'?'pause':'show'}]});
    window.definition = {setting:'home',title:text('A physical scene'),initial:frame(25),choices:{a:frame(55,'present'),b:frame(35,'work','pause')}};
    window.input = {key:'family',definition:window.definition,choiceId:null,previewChoiceId:null};
    window.fallbacks = [];
    window.stage = createMission3DStage(document.querySelector('#fixture'),language, value => window.fallbacks.push(value));
    window.stage.setActive(false);
    window.stage.update(window.input);
  }, language);
};
const snapshot = page => page.evaluate(() => window.stage.snapshot());
const person = state => state.entities.find(entity => entity.id === 'person');
const canvasPixels = async page => page.screenshot({clip: await page.locator('canvas').boundingBox()});
const wheel = (page, deltaY, options = {}) => page.evaluate(({deltaY, options}) => {
  const {target: targetName = 'canvas', ...init} = options;
  const target = targetName === 'body' ? document.body : targetName === 'saved' ? window.savedCanvas : document.querySelector('canvas');
  const event = new WheelEvent('wheel', {deltaY: Number.isFinite(deltaY) ? deltaY : 0, bubbles: true, cancelable: true, ...init});
  if (!Number.isFinite(deltaY)) Object.defineProperty(event, 'deltaY', {value: deltaY});
  target.dispatchEvent(event);
  return {prevented: event.defaultPrevented, zoom: window.stage.snapshot().camera.zoom, renderCount: window.stage.snapshot().renderCount};
}, {deltaY, options});
const keydown = (page, key, options = {}) => page.evaluate(({key, options}) => {
  const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...options});
  document.querySelector('canvas').dispatchEvent(event);
  return {prevented: event.defaultPrevented, zoom: window.stage.snapshot().camera.zoom};
}, {key, options});

test('manual zoom changes real WebGL pixels and survives stage navigation without starting an idle loop', async () => {
  const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false}}); await server.listen();
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:600},reducedMotion:'reduce'});
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await setup(page,`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.evaluate(() => {window.stage.setActive(true);window.stage.setMotion(false);window.input={...window.input,choiceId:'a',comparisonView:'after',animate:false};window.stage.update(window.input);});
    const canvas = page.locator('canvas');
    assert.equal(await canvas.getAttribute('tabindex'),'0','the canvas can receive keyboard zoom controls');
    await canvas.focus();
    await page.keyboard.press('Shift+=');
    assert.ok((await snapshot(page)).camera.zoom>1,'+ zooms in from the focused canvas');
    await page.keyboard.press('-');
    assert.ok(Math.abs((await snapshot(page)).camera.zoom-1)<.000001,'- zooms out from the focused canvas');
    await page.evaluate(() => window.stage.setMotion(true));
    const reducedWheel = await wheel(page,-32), reducedZoom = await snapshot(page);
    assert.equal(reducedWheel.prevented,true,'reduced-motion preference does not disable manual zoom');
    assert.ok(reducedZoom.camera.zoom>1);
    assert.equal(reducedZoom.animating,false);
    await page.clock.fastForward(250);
    assert.equal((await snapshot(page)).renderCount,reducedZoom.renderCount,'reduced-motion zoom leaves no idle RAF');
    await keydown(page,'0');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(() => window.stage.setMotion(false));
    const afterBase = await snapshot(page), initialPixels = await canvasPixels(page);
    assert.equal(afterBase.mode,'webgl');
    assert.equal(afterBase.camera.zoom,1,'new stages start at the original camera scale');
    assert.match(await page.locator('canvas').getAttribute('title'),/拖曳.*滾輪.*雙擊.*0/);
    assert.match(await page.locator('canvas').getAttribute('aria-label'),/拖曳.*滾輪.*雙擊.*0/);

    const firstWheel = await wheel(page,-32);
    const zoomedAfter = await snapshot(page);
    assert.equal(firstWheel.prevented,true,'an active canvas consumes a vertical wheel that changes zoom');
    assert.ok(zoomedAfter.camera.zoom>1);
    assert.ok(person(zoomedAfter).projected.width>person(afterBase).projected.width,'the projected actor grows at the new camera scale');
    assert.notDeepEqual(await canvasPixels(page),initialPixels,'zoom changes rendered WebGL pixels');
    assert.equal(zoomedAfter.animating,false,'manual zoom works while motion is paused');
    await page.clock.fastForward(250);
    assert.equal((await snapshot(page)).renderCount,zoomedAfter.renderCount,'manual zoom schedules one draw without an idle RAF');

    assert.equal((await keydown(page,'0')).prevented,true);
    const resetToDefault = await snapshot(page);
    assert.equal(resetToDefault.camera.zoom,1,'0 resets only the camera scale');
    assert.ok(person(resetToDefault).projected.width<person(zoomedAfter).projected.width,'reset zoom shrinks the projected actor back to its baseline');
    assert.deepEqual(await canvasPixels(page),initialPixels,'reset restores the original rendered pixels');
    await page.evaluate(() => {window.input.comparisonView='before';window.stage.update(window.input);});
    const beforeBase = await snapshot(page);
    await wheel(page,-32);
    const zoomedBefore = await snapshot(page);
    assert.ok(zoomedBefore.camera.zoom>1,'before comparison keeps user zoom');
    await page.evaluate(() => {window.input.comparisonView='after';window.stage.update(window.input);});
    const zoomedAfterAgain = await snapshot(page);
    const beforeFactor = person(zoomedBefore).projected.width/person(beforeBase).projected.width;
    const afterFactor = person(zoomedAfterAgain).projected.width/person(afterBase).projected.width;
    assert.ok(Math.abs(beforeFactor-afterFactor)<.01,'before and after views apply the same zoom factor');
    assert.equal(zoomedAfterAgain.camera.zoom,zoomedBefore.camera.zoom);
    assert.equal(zoomedAfterAgain.choiceId,'a','comparison does not change the selected answer');

    await page.evaluate(() => {const host=document.querySelector('#fixture');host.style.width='640px';host.style.height='320px';window.input={...window.input,previewChoiceId:'b'};window.stage.update(window.input);window.dispatchEvent(new Event('resize'));});
    const retargeted = await snapshot(page);
    assert.equal(retargeted.camera.zoom,zoomedAfterAgain.camera.zoom,'resize and choice retarget preserve zoom');
    assert.equal(retargeted.choiceId,'a'); assert.equal(retargeted.previewChoiceId,'b','zoom does not change answer or preview data');
    await page.evaluate(() => {window.stage.setMotion(true);window.stage.replay();});
    assert.equal((await snapshot(page)).animating,true,'replay remains available after manual zoom');
    await page.clock.fastForward(3000);
    assert.equal((await snapshot(page)).camera.zoom,zoomedAfterAgain.camera.zoom,'replay preserves zoom through the animation');

    const canvasBox = await page.locator('canvas').boundingBox();
    await page.mouse.move(canvasBox.x+180,canvasBox.y+150);
    await page.mouse.down(); await page.mouse.move(canvasBox.x+300,canvasBox.y+150,{steps:3}); await page.mouse.up();
    const dragged = await snapshot(page), draggedCamera = dragged.camera.position;
    assert.notDeepEqual(draggedCamera,afterBase.camera.position,'drag continues to rotate the camera while zoomed');
    assert.equal(dragged.camera.zoom,zoomedAfterAgain.camera.zoom,'drag preserves the current zoom');
    await wheel(page,-32);
    await page.mouse.dblclick(canvasBox.x+300,canvasBox.y+150);
    const reset = await snapshot(page);
    assert.equal(reset.camera.zoom,1,'double-click resets zoom');
    assert.deepEqual(reset.camera.position,afterBase.camera.position,'double-click also resets yaw');

    await wheel(page,-32);
    await page.evaluate(() => {window.input={...window.input,key:'another-mission',animate:false};window.stage.update(window.input);});
    assert.equal((await snapshot(page)).camera.zoom,1,'a new mission key resets user zoom');
    await page.evaluate(() => window.stage.dispose());
  } finally {await browser.close();await server.close();}
});

test('wheel normalization, bounds, browser shortcuts, and inactive canvases preserve page scrolling', async () => {
  const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false}}); await server.listen();
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:600}});
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await setup(page,`http://127.0.0.1:${server.httpServer.address().port}`,'en');
    await page.evaluate(() => {window.stage.setActive(true);window.stage.setMotion(false);window.input={...window.input,animate:false};window.stage.update(window.input);});
    assert.match(await page.locator('canvas').getAttribute('title'),/Drag.*wheel.*double-click.*0/i);
    const wrapperControls = await page.evaluate(async () => {
      const {createMissionStage} = await import('/src/mission-stage.ts');
      const host = document.createElement('div'); host.id = 'mission-wrapper-fixture'; host.style.width = '900px'; host.style.height = '450px'; document.body.append(host);
      window.wrapperStage = createMissionStage(host,'en'); window.wrapperStage.setActive(false); window.wrapperStage.update(window.input);
      const canvas = host.querySelector('canvas');
      return {title: canvas.title, label: canvas.getAttribute('aria-label')};
    });
    assert.match(wrapperControls.title,/Drag.*wheel.*double-click.*0/i);
    assert.match(wrapperControls.label,/Drag.*wheel.*double-click.*0/i);
    await page.evaluate(() => window.wrapperStage.dispose());

    const bodyWheel = await wheel(page,-40,{target:'body'});
    assert.equal(bodyWheel.prevented,false,'wheel input outside the canvas remains available to the page');
    assert.equal(bodyWheel.zoom,1);
    for (const [deltaY, options] of [[0,{deltaX:30}],[-80,{ctrlKey:true}],[-80,{metaKey:true}],[Number.NaN,{}]]) {
      const ignored = await wheel(page,deltaY,options);
      assert.equal(ignored.prevented,false,'horizontal-only, nonfinite, and browser-zoom gestures are ignored');
      assert.equal(ignored.zoom,1);
    }
    const pixel = await wheel(page,-32,{deltaMode:0});
    assert.equal(pixel.prevented,true);
    await keydown(page,'0');
    const line = await wheel(page,-2,{deltaMode:1});
    assert.ok(Math.abs(line.zoom-pixel.zoom)<.000001,'two line units equal 32 pixel units');
    await keydown(page,'0');
    const pageUnit = await wheel(page,-32/600,{deltaMode:2});
    assert.ok(Math.abs(pageUnit.zoom-pixel.zoom)<.000001,'page units use the browser viewport height');
    await keydown(page,'0');
    for (let index=0;index<8;index++) await wheel(page,-1000000);
    assert.equal((await snapshot(page)).camera.zoom,2.4,'large wheel deltas clamp to the maximum zoom');
    assert.equal((await wheel(page,-1000000)).prevented,false,'the page keeps scrolling when zoom is already at its maximum');
    for (let index=0;index<8;index++) await wheel(page,1000000);
    assert.equal((await snapshot(page)).camera.zoom,.65,'zoom clamps to the minimum');
    assert.equal((await wheel(page,1000000)).prevented,false,'the page keeps scrolling when zoom is already at its minimum');
    assert.equal((await keydown(page,'+', {ctrlKey:true})).prevented,false,'keyboard browser zoom shortcuts are left alone');

    await page.evaluate(() => window.stage.setActive(false));
    assert.equal((await wheel(page,-80)).prevented,false,'an inactive stage never consumes wheel input');
    await page.evaluate(() => {window.stage.setActive(true);document.querySelector('canvas').style.visibility='hidden';});
    assert.equal((await wheel(page,-80)).prevented,false,'a hidden canvas never consumes wheel input');
    await page.evaluate(() => {document.querySelector('canvas').style.visibility='';Object.defineProperty(document,'hidden',{configurable:true,value:true});});
    assert.equal((await wheel(page,-80)).prevented,false,'a hidden document never consumes wheel input');
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});window.savedHost=document.querySelector('#fixture');window.savedCanvas=document.querySelector('canvas');window.savedHost.remove();});
    assert.equal((await wheel(page,-80,{target:'saved'})).prevented,false,'a detached canvas never consumes wheel input');
    await page.evaluate(() => {document.body.append(window.savedHost);window.savedCanvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));});
    assert.equal((await wheel(page,-80)).prevented,false,'a lost WebGL context never consumes wheel input');
    await page.evaluate(() => {window.savedCanvas=document.querySelector('canvas');window.stage.dispose();});
    assert.equal((await wheel(page,-80,{target:'saved'})).prevented,false,'disposing a stage removes its wheel listener');
  } finally {await browser.close();await server.close();}
});

test('manual comparison cues alter only changed visible models, expire exactly, and release lifecycle work', async () => {
  const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false}}); await server.listen();
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:600}});
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await setup(page,`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.evaluate(() => {window.stage.setActive(true);window.stage.setMotion(false);window.input={...window.input,choiceId:'a',comparisonView:'after',animate:false};window.stage.update(window.input);});
    const initial=await snapshot(page), original=await canvasPixels(page);
    assert.equal(initial.comparisonCue.active,false,'selecting the first answer does not trigger a cue');
    await page.evaluate(() => {window.input.comparisonCue={token:1,entityIds:['person','phone','missing'],durationMs:2200};window.stage.update(window.input);});
    const highlighted=await snapshot(page);
    assert.deepEqual(highlighted.comparisonCue,{active:true,token:1,entityIds:['person']},'unchanged and missing requested IDs are ignored');
    assert.notDeepEqual(await canvasPixels(page),original,'warmth changes real WebGL pixels');
    assert.deepEqual(highlighted.entities,initial.entities,'cue leaves all geometry and visibility unchanged');
    assert.deepEqual(highlighted.camera,initial.camera,'cue leaves camera unchanged');
    await page.evaluate(() => {const {comparisonCue,...withoutCue}=window.input;window.stage.update(withoutCue);});
    assert.equal((await snapshot(page)).comparisonCue.active,false,'removing command clears cue despite identical physical scene');
    assert.deepEqual(await canvasPixels(page),original,'command removal restores exact pixels');
    await page.evaluate(() => {window.input.comparisonCue.token=11;window.stage.update(window.input);});
    const highlightedAgain=await snapshot(page);
    const renders=highlightedAgain.renderCount;
    await page.clock.fastForward(1000);
    assert.equal((await snapshot(page)).renderCount,renders,'paused static cue owns no RAF');
    await page.evaluate(() => {window.input.comparisonCue={token:2,entityIds:['person'],durationMs:2200};window.stage.update(window.input);});
    await page.clock.fastForward(1201);
    assert.equal((await snapshot(page)).comparisonCue.active,true,'old token cannot clear the latest token');
    await page.clock.fastForward(999);
    assert.equal((await snapshot(page)).comparisonCue.active,false);
    assert.deepEqual(await canvasPixels(page),original,'expiry restores exact colors, emissive values and original alpha');
    const expired=await snapshot(page);
    await page.clock.fastForward(3000);
    assert.equal((await snapshot(page)).renderCount,expired.renderCount,'expired cue leaves no timer or RAF work');
    await page.evaluate(() => window.stage.update(window.input));
    assert.equal((await snapshot(page)).comparisonCue.active,false,'reusing an expired token never restarts it');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(() => {window.stage.setMotion(true);window.input.comparisonCue={token:3,entityIds:['person'],durationMs:2200};window.stage.update(window.input);});
    assert.equal((await snapshot(page)).comparisonCue.active,true,'reduced motion retains a static cue');
    assert.equal((await snapshot(page)).animating,false);
    await page.evaluate(() => {window.input={...window.input,comparisonView:'before',comparisonCue:{token:4,entityIds:['person'],durationMs:2200}};window.stage.update(window.input);});
    assert.equal((await snapshot(page)).comparisonCue.active,true,'before supports the same changed model cue');
    await page.evaluate(() => {window.input.choiceId=null;window.stage.update(window.input);});
    assert.equal((await snapshot(page)).comparisonCue.active,false,'retargeting to unselected clears highlight');
    await page.evaluate(() => {window.input={...window.input,choiceId:'b',comparisonView:'before',comparisonCue:{token:5,entityIds:['person','stop'],durationMs:2200}};window.stage.update(window.input);});
    assert.deepEqual((await snapshot(page)).comparisonCue.entityIds,['person','stop']);
    await page.evaluate(() => window.stage.setActive(false));
    assert.equal((await snapshot(page)).comparisonCue.active,false,'inactive stage clears cue');
    const inactive=await snapshot(page);
    await page.clock.fastForward(3000);
    assert.equal((await snapshot(page)).renderCount,inactive.renderCount,'inactive stage cancels expiry render');
    await page.evaluate(() => {window.stage.setActive(true);window.input.comparisonCue={token:6,entityIds:['person'],durationMs:2200};window.stage.update(window.input);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal((await snapshot(page)).comparisonCue.active,false,'hidden document clears cue');
    const hidden=await snapshot(page);
    await page.clock.fastForward(3000);
    assert.equal((await snapshot(page)).renderCount,hidden.renderCount);
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});window.input.comparisonCue={token:7,entityIds:['person'],durationMs:2200};window.stage.update(window.input);document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}));});
    assert.equal((await snapshot(page)).comparisonCue.active,false,'context loss clears material state and timer');
    const lost=await snapshot(page);
    await page.clock.fastForward(3000);
    assert.equal((await snapshot(page)).renderCount,lost.renderCount);
    await page.evaluate(() => window.stage.dispose());
    await page.clock.fastForward(3000);
    assert.equal(await page.locator('canvas').count(),0);
  } finally {await browser.close();await server.close();}
});

test('before/after comparison preserves answers, fixes framing, and renders actual scene differences', async () => {
  const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false}}); await server.listen();
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:600}});
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await setup(page,`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.evaluate(() => {window.stage.setActive(true);window.input.comparisonView='after';window.stage.update(window.input);window.input.choiceId='a';window.stage.update(window.input);});
    assert.equal((await snapshot(page)).animating,true,'first selected action retains normal playback');
    await page.clock.fastForward(2900);
    assert.equal((await snapshot(page)).progress,1);
    for (const width of [320,390,430,900]) {
      await page.evaluate(width => {const host=document.querySelector('#fixture');host.style.width=`${width}px`;host.style.height=width<600?'272px':'450px';window.input={...window.input,comparisonView:'after',animate:false,previewChoiceId:'b'};window.stage.update(window.input);window.dispatchEvent(new Event('resize'));},width);
      await page.clock.fastForward(32);
      const afterPixels = await canvasPixels(page);
      const after = await snapshot(page);
      assert.equal(after.mode,'webgl');
      assert.equal(after.choiceId,'a'); assert.equal(after.previewChoiceId,'b');
      assert.ok(after.effects.some(effect=>effect.action==='pause' && effect.target==='stop'),'action focus names the specific paused target');
      await page.evaluate(() => {window.input.comparisonView='before';window.stage.update(window.input);});
      const before = await snapshot(page);
      assert.equal(before.comparisonView,'before');
      assert.equal(before.phase,'ready','before describes the initial scene even when an answer exists');
      assert.equal(before.choiceId,'a'); assert.equal(before.previewChoiceId,'b','comparison never clears preview or answer');
      assert.equal(await page.locator('canvas').getAttribute('data-comparison-view'),'before');
      assert.deepEqual(before.camera,after.camera,'both states share exactly the same camera');
      assert.notDeepEqual(person(before).position,person(after).position,'actor changes real world position');
      assert.notDeepEqual(person(before).joints,person(after).joints,'actor changes actual joint pose');
      assert.equal(before.effects.length,0,'initial scene has no selected action focus');
      assert.notDeepEqual(await canvasPixels(page),afterPixels,'toggle changes real WebGL pixels');
      assert.equal(before.animating,false,'manual comparison settles immediately');
      await page.evaluate(() => window.stage.replay());
      assert.equal((await snapshot(page)).animating,false,'before view does not replay a selected action');
      await page.evaluate(() => {window.input.comparisonView='after';window.stage.update(window.input);});
      const restored = await snapshot(page);
      assert.deepEqual(restored.entities,after.entities,'return restores exact selected transforms');
      assert.deepEqual(await canvasPixels(page),afterPixels,'return restores exact selected pixels');
      const renders = restored.renderCount;
      await page.clock.fastForward(300);
      assert.equal((await snapshot(page)).renderCount,renders,'comparison has no idle RAF');
      for (const state of [before,after]) for (const entity of state.entities.filter(entity=>entity.visible)) {
        assert.ok(entity.projected.left>=-1 && entity.projected.right<=width+1,`comparison fits ${entity.id} at ${width}px`);
        assert.ok(entity.projected.top>=53,`comparison respects the mobile toolbar exclusion for ${entity.id}`);
      }
    }
    await page.evaluate(() => window.stage.replay());
    assert.equal((await snapshot(page)).animating,true,'explicit replay remains available after manual comparison');
    await page.clock.fastForward(1000);
    await page.evaluate(() => window.stage.setActive(false));
    const paused = await snapshot(page);
    assert.equal(paused.progress,1); assert.equal(paused.animating,false);
    await page.clock.fastForward(300);
    assert.equal((await snapshot(page)).renderCount,paused.renderCount,'paused comparison releases RAF');
    assert.equal(await page.locator('canvas').count(),1,'comparison reuses one canvas and context');
    await page.evaluate(() => {
      window.stage.setActive(true);
      const definition=structuredClone(window.definition);
      definition.choices.a.entities=definition.choices.a.entities.map(entity=>entity.id==='phone'?{...entity,kind:'screen'}:entity);
      window.input={key:'kind-change',definition,choiceId:'a',previewChoiceId:null,comparisonView:'after',animate:false};
      window.stage.update(window.input);
    });
    const kindAfter = await snapshot(page);
    const kindPixels = await canvasPixels(page);
    assert.equal(kindAfter.entities.find(entity=>entity.id==='phone').kind,'screen');
    await page.evaluate(() => {window.input.comparisonView='before';window.stage.update(window.input);});
    const kindBefore = await snapshot(page);
    assert.equal(kindBefore.entities.find(entity=>entity.id==='phone').kind,'phone');
    assert.deepEqual(kindBefore.camera,kindAfter.camera,'same-id geometry changes use each frame own model for common bounds');
    await page.evaluate(() => {window.input.comparisonView='after';window.stage.update(window.input);});
    assert.deepEqual(await canvasPixels(page),kindPixels,'returning to a changed kind restores exact pixels and materials');
    await page.evaluate(() => window.stage.dispose());
  } finally {await browser.close();await server.close();}
});

test('real WebGL mission actors articulate, interact, retarget, and stop rendering', async () => {
  const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false}});
  await server.listen();
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:600}});
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    await setup(page,origin);
    assert.equal((await snapshot(page)).renderCount,0,'inactive stage never initializes renderer');
    await page.evaluate(() => {window.stage.setActive(true); window.canvas = document.querySelector('canvas');});
    const initial = await snapshot(page);
    assert.equal(initial.mode,'webgl','test exercises a real WebGL context');
    assert.equal(initial.entities.length,4);
    assert.equal(person(initial).position[1],0,'person stands on floor');
    await mkdir('test-results/mission-3d',{recursive:true});
    await page.screenshot({path:'test-results/mission-3d/initial.png'});
    await page.evaluate(() => {window.input.previewChoiceId='a';window.stage.update(window.input);});
    await page.clock.fastForward(210);
    const moving = await snapshot(page);
    assert.equal(moving.animating,true);
    assert.ok(person(moving).position[0] > -3 && person(moving).position[0] < .6,'actor walks through real 3D positions');
    assert.notDeepEqual(person(moving).joints,person(initial).joints,'walking bends articulated joints');
    await page.screenshot({path:'test-results/mission-3d/walking.png'});
    await page.evaluate(() => {window.input.previewChoiceId=null;window.input.choiceId='a';window.stage.update(window.input);});
    const adopted = await snapshot(page);
    assert.ok(adopted.progress>=moving.progress,'accepting preview preserves ongoing physical animation');
    await page.clock.fastForward(390);
    const working = await snapshot(page);
    assert.ok(working.progress>.4 && working.progress<.85);
    assert.ok(Math.abs(person(working).joints[9])>.4,'actor reaches forward during performance');
    const heldPhone = working.entities.find(entity=>entity.id==='phone');
    assert.ok(Math.hypot(heldPhone.position[0],heldPhone.position[2]+.4)>.1,'the actual phone moves off its tabletop position into the actor interaction');
    await page.screenshot({path:'test-results/mission-3d/reach.png'});
    await page.evaluate(() => {window.input.choiceId='b';window.stage.update(window.input);});
    const retargeted = await snapshot(page);
    assert.deepEqual(person(retargeted).position,person(working).position,'retarget starts at current visible position');
    await page.clock.fastForward(2900);
    const stopped = await snapshot(page);
    assert.equal(stopped.progress,1);
    assert.ok(Math.abs(person(stopped).position[0] + 1.8)<.0001);
    assert.equal(stopped.flowCount,1);
    await page.screenshot({path:'test-results/mission-3d/result-b.png'});
    await page.clock.fastForward(180);
    assert.equal((await snapshot(page)).renderCount,stopped.renderCount,'settled stage has no idle render loop');
    await page.evaluate(() => window.stage.update({...window.input,definition:structuredClone(window.definition)}));
    assert.equal((await snapshot(page)).renderCount,stopped.renderCount,'equivalent physical frame does not replay or redraw');
    await page.evaluate(() => window.stage.replay());
    const replay = await snapshot(page);
    assert.equal(replay.animating,true);
    assert.equal(person(replay).position[0],-3,'explicit replay begins with initial frame');
    await page.evaluate(() => window.stage.setActive(false));
    assert.equal((await snapshot(page)).animating,false);
    assert.equal((await snapshot(page)).progress,1);
    await page.evaluate(() => {const host=document.querySelector('#fixture');host.remove();document.body.append(host);window.stage.setActive(true);});
    assert.equal(await page.evaluate(() => window.canvas === document.querySelector('canvas')),true,'detach/reinsert preserves canvas and WebGL context');
    assert.equal((await snapshot(page)).animating,false,'resume does not replay');
    await page.evaluate(() => {window.input.choiceId='a';window.stage.update(window.input);window.stage.setMotion(false);});
    assert.equal((await snapshot(page)).progress,1);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(() => {window.stage.setMotion(true);window.input.choiceId='b';window.stage.update(window.input);});
    assert.equal((await snapshot(page)).animating,false,'reduced motion settles immediately');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(() => {window.input.choiceId='a';window.stage.update(window.input);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal((await snapshot(page)).animating,false,'hidden document cancels RAF');
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});});
    await page.evaluate(() => {window.stage.setMotion(false);window.input={key:'restore-materials',definition:window.definition,choiceId:null,previewChoiceId:null};window.stage.update(window.input);});
    const originalPixels = await page.screenshot({clip:{x:0,y:0,width:900,height:450}});
    await page.evaluate(() => {
      const initial={...window.definition.initial,entities:window.definition.initial.entities.map(entity=>entity.id==='phone'?{...entity,opacity:0}:entity)};
      window.stage.update({...window.input,definition:{...window.definition,initial}});
    });
    const hiddenPixels = await page.screenshot({clip:{x:0,y:0,width:900,height:450}});
    assert.notDeepEqual(hiddenPixels,originalPixels,'hiding phone changes actual rendered pixels');
    await page.evaluate(() => {
      const initial={...window.definition.initial,entities:window.definition.initial.entities.filter(entity=>entity.id!=='phone')};
      window.stage.update({...window.input,key:'without-phone',definition:{...window.definition,initial}});
      window.stage.update(window.input);
    });
    assert.deepEqual(await page.screenshot({clip:{x:0,y:0,width:900,height:450}}),originalPixels,'cached model restores original material opacity after hide/remove/return');
    await page.evaluate(async () => {
      const {JOURNEY_2026} = await import('/src/reading-journeys.ts');
      const mission=JOURNEY_2026.personas.flatMap(role=>role.questions.flatMap(question=>question.steps)).map(step=>step.mission).find(mission=>mission.id==='seen-remembered-1');
      window.realInput={key:mission.id,definition:mission.visual,choiceId:'a',previewChoiceId:null};
      window.stage.update(window.realInput);
    });
    const realA = await snapshot(page);
    const realPixelsA = await page.screenshot({clip:{x:0,y:0,width:900,height:450}});
    await page.evaluate(() => {window.stage.update({...window.realInput,choiceId:'b'});window.stage.update({...window.realInput,choiceId:'b',previewChoiceId:'a'});});
    const realPreviewA = await snapshot(page);
    assert.deepEqual(realPreviewA.entities,realA.entities,'real mission A/B/preview A has exactly the same terminal object transforms');
    assert.deepEqual(await page.screenshot({clip:{x:0,y:0,width:900,height:450}}),realPixelsA,'real mission A/B/preview A has exactly the same rendered pixels');
    for (const setting of ['home','community','office','commute','brand-studio','meeting','production','insight-lab']) {
      await page.evaluate(setting => {window.input={...window.input,key:setting,definition:{...window.definition,setting}};window.stage.update(window.input);},setting);
      assert.equal((await snapshot(page)).mode,'webgl');
      assert.equal((await snapshot(page)).animating,false);
      assert.equal(await page.locator('canvas').getAttribute('data-setting'),setting);
      await page.screenshot({path:`test-results/mission-3d/room-${setting}.png`});
    }
    const canLose = await page.evaluate(() => {
      window.stage.setMotion(true);
      window.stage.replay();
      const extension = window.canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      extension?.loseContext();
      return Boolean(extension);
    });
    assert.equal(canLose,true,'browser provides a real context-loss extension');
    await page.waitForTimeout(100);
    const lost = await snapshot(page);
    assert.equal(lost.mode,'fallback'); assert.equal(lost.animating,false);
    assert.deepEqual(await page.evaluate(() => window.fallbacks),[false,true]);
    await page.evaluate(() => {window.stage.dispose();window.stage.dispose();window.stage.update(window.input);window.stage.replay();});
    assert.equal(await page.locator('canvas').count(),0);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await server.close();}
});

test('missing WebGL exposes fallback and never simulates 3D playback', async () => {
  const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false}}); await server.listen();
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:original.call(this,type,...args);};});
    await setup(page,`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.evaluate(() => {window.stage.setActive(true);window.input.choiceId='a';window.stage.update(window.input);window.stage.replay();});
    const state = await snapshot(page);
    assert.equal(state.mode,'fallback');assert.equal(state.animating,false);assert.equal(state.renderCount,0);
    assert.deepEqual(await page.evaluate(() => window.fallbacks),[true]);
    await page.evaluate(() => window.stage.dispose());
  } finally {await browser.close();await server.close();}
});
