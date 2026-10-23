import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

test('illustrated mission stage moves, settles, retargets, and respects lifecycle', async () => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const address = server.httpServer.address();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${address.port}`;
    await page.route(`${origin}/__mission_fixture`, route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><main id="fixture" style="width:720px"></main></body></html>'}));
    await page.goto(`${origin}/__mission_fixture`);
    await page.evaluate(async () => {
      const {createMissionStage} = await import('/src/mission-stage.ts');
      const text = value => ({zh:value,en:value});
      const frame = (x, pose='idle') => ({description:text(`人物移動到 ${x}`),entities:[{id:'person',kind:'adult',x,y:75,pose,label:text('使用者')},{id:'assistant',kind:'robot',x:70,y:75},{id:'phone',kind:'phone',x:50,y:65,opacity:x===25?.3:1}],flows:x===25?[]:[{id:'share',from:'person',to:'assistant',kind:'share'}]});
      window.definition = {setting:'home',title:text('<家庭情境>'),initial:frame(25),choices:{a:frame(55,'present'),b:frame(35,'walk')}};
      window.input = {key:'family',definition:window.definition,choiceId:null,previewChoiceId:null};
      window.stage = createMissionStage(document.querySelector('#fixture'),'zh');
      window.stage.update(window.input);
    });
    const initial = await page.locator('[data-scene-entity="person"]').evaluate(node=>({transform:getComputedStyle(node).transform}));
    assert.equal(await page.locator('svg[data-setting="home"]').count(),1);
    assert.equal(await page.locator('svg title').textContent(),'<家庭情境>');
    await page.evaluate(()=>{window.personNode=document.querySelector('[data-scene-entity="person"]');window.input.choiceId='a';window.stage.update(window.input);});
    await page.waitForTimeout(250);
    const mid = await page.locator('[data-scene-entity="person"]').evaluate(node=>({x:new DOMMatrix(getComputedStyle(node).transform).m41,animations:document.getAnimations().length}));
    assert.ok(mid.x>180 && mid.x<396,`visible intermediate x ${mid.x}`);
    assert.ok(mid.animations>0);
    await page.evaluate(()=>{window.input.choiceId='b';window.stage.update(window.input);});
    const retarget = await page.locator('[data-scene-entity="person"]').evaluate(node=>new DOMMatrix(getComputedStyle(node).transform).m41);
    assert.ok(Math.abs(retarget-mid.x)<35,'retarget starts at visible position');
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('[data-scene-entity="person"]').evaluate(node=>new DOMMatrix(getComputedStyle(node).transform).m41),252);
    assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
    assert.equal(await page.evaluate(()=>window.personNode===document.querySelector('[data-scene-entity="person"]')),true);
    await page.evaluate(()=>window.stage.update({...window.input,definition:structuredClone(window.definition)}));
    assert.equal(await page.evaluate(()=>document.getAnimations().length),0,'equivalent input does not replay');
    await page.evaluate(()=>{window.input.previewChoiceId='a';window.stage.update(window.input);window.stage.setMotion(false);});
    assert.equal(await page.locator('.mission-stage').getAttribute('data-preview'),'true');
    assert.match(await page.locator('figcaption').textContent(),/預覽/);
    assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
    assert.equal(await page.locator('[data-scene-entity="person"]').evaluate(node=>new DOMMatrix(getComputedStyle(node).transform).m41),396);
    await page.evaluate(()=>{window.stage.setMotion(true);window.stage.setActive(false);window.input.previewChoiceId=null;window.input.choiceId='b';window.stage.update(window.input);window.stage.setActive(true);});
    assert.equal(await page.evaluate(()=>document.getAnimations().length),0,'inactive update and resume remain at terminal state');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{window.input.choiceId='a';window.stage.update(window.input);});
    assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{window.input.choiceId='b';window.stage.update(window.input);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.evaluate(()=>document.getAnimations().length),0,'hidden document cancels playback');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});});
    for (const setting of ['community','office','commute','brand-studio','meeting','production','insight-lab']) {
      await page.evaluate(setting=>{window.input={...window.input,key:setting,definition:{...window.definition,setting},choiceId:'a'};window.stage.update(window.input);},setting);
      assert.equal(await page.locator(`svg[data-setting="${setting}"]`).count(),1);
      assert.equal(await page.evaluate(()=>document.getAnimations().length),0,'new mission starts at its terminal frame');
    }
    await page.evaluate(()=>{window.stage.dispose();window.stage.update(window.input);});
    assert.equal(await page.locator('.mission-stage').count(),0);
    assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
    assert.ok(initial.transform);
  } finally {
    await browser.close();
    await server.close();
  }
});
