import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const setup = async (page, origin) => {
  await page.route(`${origin}/__mission_3d_fixture`, route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#edf0e3"><main id="fixture" style="width:900px;height:450px"></main></body></html>'}));
  await page.goto(`${origin}/__mission_3d_fixture`);
  await page.evaluate(async () => {
    const { createMission3DStage } = await import('/src/mission-3d-stage.ts');
    const text = value => ({zh:value,en:value});
    const frame = (x, pose = 'idle', kind = 'share') => ({description:text(`Action ${x}`),entities:[{id:'person',kind:'adult',x,y:75,pose},{id:'assistant',kind:'robot',x:70,y:75,pose:'listen'},{id:'phone',kind:'phone',x:50,y:60},{id:'stop',kind:'stop',x:58,y:60,opacity:kind==='pause'?1:.15}],flows:x===25?[]:[{id:'transfer',from:'person',to:'assistant',kind}],actions:[{actor:'person',target:kind==='pause'?'stop':'assistant',prop:'phone',kind:kind==='pause'?'pause':'show'}]});
    window.definition = {setting:'home',title:text('A physical scene'),initial:frame(25),choices:{a:frame(55,'present'),b:frame(35,'work','pause')}};
    window.input = {key:'family',definition:window.definition,choiceId:null,previewChoiceId:null};
    window.fallbacks = [];
    window.stage = createMission3DStage(document.querySelector('#fixture'),'zh', value => window.fallbacks.push(value));
    window.stage.setActive(false);
    window.stage.update(window.input);
  });
};
const snapshot = page => page.evaluate(() => window.stage.snapshot());
const person = state => state.entities.find(entity => entity.id === 'person');
const canvasPixels = async page => page.screenshot({clip: await page.locator('canvas').boundingBox()});

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
    await page.clock.fastForward(420);
    const moving = await snapshot(page);
    assert.equal(moving.animating,true);
    assert.ok(person(moving).position[0] > -3 && person(moving).position[0] < .6,'actor walks through real 3D positions');
    assert.notDeepEqual(person(moving).joints,person(initial).joints,'walking bends articulated joints');
    await page.screenshot({path:'test-results/mission-3d/walking.png'});
    await page.evaluate(() => {window.input.previewChoiceId=null;window.input.choiceId='a';window.stage.update(window.input);});
    const adopted = await snapshot(page);
    assert.ok(adopted.progress>=moving.progress,'accepting preview preserves ongoing physical animation');
    await page.clock.fastForward(780);
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
