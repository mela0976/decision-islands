import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:4174/';
await mkdir('test-results', {recursive:true});
const browser = await chromium.launch({headless:true});
const results = [];
const errors = [];
async function context(options = {}) {
  const ctx = await browser.newContext({viewport:{width:1280,height:900}, reducedMotion:'reduce', ...options});
  await ctx.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return String(type).includes('webgl') ? null : get.call(this,type,...args); };
  });
  return ctx;
}
async function boot(ctx, url = base) {
  const page = await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('.article-row').first().waitFor({state:'attached'});return page;
}
async function picker(page) {
  if(await page.locator('#journey-picker[open]').count()) await page.keyboard.press('Escape');
  if(await page.locator('#my-reading').isVisible()) await page.locator('#my-reading').click();
  else await page.locator('#enter').click();
}
async function task(page, audience, role, question) {
  await picker(page);await page.locator(`#journey-picker [data-audience="${audience}"]`).click();await page.locator(`#journey-picker [data-role="${role}"]`).click();
  if(question) await page.locator(`#journey-picker [data-question="${question}"]`).click();else await page.locator('[data-skip-question]').click();
  await page.locator('.mission-stage svg').waitFor();
}
async function physical(page) {
  return page.locator('.mission-stage svg').evaluate(svg=>JSON.stringify({
    setting:svg.dataset.setting,
    entities:[...svg.querySelectorAll('[data-scene-entity]')].map(e=>[e.dataset.sceneEntity,getComputedStyle(e).transform,getComputedStyle(e).opacity,e.querySelector('use').getAttribute('href')]).sort(),
    flows:[...svg.querySelectorAll('[data-scene-flow]')].map(e=>[e.getAttribute('d'),e.dataset.kind]).sort(),
  }));
}
try {
  const ctx=await context();const page=await boot(ctx);const routes=[];
  for(const audience of ['marketing','everyday']) {
    await picker(page);await page.locator(`[data-audience="${audience}"]`).click();
    const roles=await page.locator('#journey-picker [data-role]').evaluateAll(nodes=>nodes.map(n=>n.dataset.role));
    for(const role of roles) {
      await picker(page);await page.locator(`[data-audience="${audience}"]`).click();await page.locator(`#journey-picker [data-role="${role}"]`).click();
      const questions=await page.locator('#journey-picker [data-question]').evaluateAll(nodes=>nodes.map(n=>n.dataset.question));
      for(const question of questions) routes.push({audience,role,question});
    }
  }
  const settings=new Set(),missions=new Set(),captured=new Set();
  for(const route of routes) {
    await task(page,route.audience,route.role,route.question);
    for(let round=0;round<3;round++) {
      const id=await page.locator('.journey-mission').getAttribute('data-mission-id');missions.add(id);
      settings.add(await page.locator('.mission-stage svg').getAttribute('data-setting'));
      if(await page.locator('[data-mission-retry]').count()) await page.locator('[data-mission-retry]').click();
      const initial=await physical(page);
      if(!captured.has(route.role)) {await page.locator('.mission-stage').screenshot({path:`test-results/role-stage-${route.role}.png`});captured.add(route.role);}
      await page.evaluate(()=>window.__stageNode=document.querySelector('.mission-stage'));
      await page.locator('.journey-mission-choices [data-mission-choice="a"]').click();
      const a=await physical(page);assert.notEqual(a,initial,`${id} A changes physical objects or paths`);
      assert.equal(await page.evaluate(()=>window.__stageNode===document.querySelector('.mission-stage')),true,'stage survives UI replacement');
      await page.locator('.journey-mission-choices [data-mission-choice="b"]').click();
      const b=await physical(page);assert.notEqual(a,b,`${id} has different A/B objects, poses or flow geometry`);
      assert.equal(await page.locator('.mission-stage').evaluate(el=>el.getAnimations({subtree:true}).length),0);
      if(round===0) {
        await page.locator('[data-mission-compare]').click();
        assert.equal(await page.locator('.mission-stage').getAttribute('data-preview'),'true');assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'),'b');
        assert.equal(await physical(page),a,'preview shows actual alternate arrangement');
        await page.locator('[data-mission-compare]').click();assert.equal(await physical(page),b,'closing preview restores adopted arrangement');
        await page.locator('[data-mission-retry]').click();assert.equal(await physical(page),initial,'retry restores initial room');
        await page.locator('.journey-mission-choices [data-mission-choice="a"]').click();
      }
      if(round<2) await page.locator('.journey-mission [data-action="advance"]').click();
    }
  }
  assert.equal(routes.length,16);assert.equal(missions.size,48);assert.equal(settings.size,8);
  results.push('All 48 rounds and 96 choices have physical SVG changes; eight distinct settings, stable stage nodes, preview/adopt separation, retry restoration and no-WebGL rendering');
  await ctx.close();
  for(const [width,height] of [[390,844],[360,740]]) {
    const mobile=await context({viewport:{width,height}}),mp=await boot(mobile);await task(mp,'everyday','family');
    const bounds=await mp.evaluate(()=>{
      const svg=document.querySelector('.mission-stage svg').getBoundingClientRect(),footer=document.querySelector('.journey-mission .journey-rail-footer').getBoundingClientRect();
      return {svg:{y:svg.y,bottom:svg.bottom,height:svg.height},footerY:footer.y,choices:[...document.querySelectorAll('.journey-mission-choices [data-mission-choice]')].map(e=>{const r=e.getBoundingClientRect();return {y:r.y,bottom:r.bottom,height:r.height}}),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.ok(bounds.svg.y>=0&&bounds.svg.bottom<=bounds.footerY,'scene visible before a choice');
    assert.ok(bounds.choices.every(c=>c.height>=44&&c.bottom<=bounds.footerY&&c.y>=bounds.svg.bottom),`scene and both choices fit ${width}x${height}: ${JSON.stringify(bounds)}`);
    assert.equal(bounds.overflow,false);
    await mp.screenshot({path:`test-results/animated-mission-${width}.png`});
    await mp.locator('.journey-mission-choices [data-mission-choice="a"]').click();
    const after=await mp.locator('.mission-stage').boundingBox();assert.ok(after.y>=0&&after.y+after.height<height,'choice feedback keeps the scene in view');
    await mp.locator('#season').selectOption('easter');assert.equal(await mp.locator('.mission-stage').getAttribute('data-choice-id'),'a');
    await mobile.close();results.push(`${width}x${height}: stage and both 44px actions are visible, feedback keeps stage in view, season preserves choice`);
  }
  const animated=await context({reducedMotion:'no-preference'}),ap=await boot(animated);await task(ap,'everyday','family');
  const initial=await physical(ap);await ap.locator('.mission-stage svg').screenshot({path:'test-results/stage-before.png'});
  await ap.locator('.journey-mission-choices [data-mission-choice="a"]').click();
  await ap.waitForTimeout(220);
  const middle=await ap.locator('.mission-stage').evaluate(stage=>({animations:stage.getAnimations({subtree:true}).length,intermediate:[...stage.querySelectorAll('[data-scene-entity]')].some(e=>getComputedStyle(e).transform!==new DOMMatrix(e.style.transform).toString())}));
  assert.ok(middle.animations>0&&middle.intermediate,'real intermediate object motion remains through rail rerender');
  const midPixels=await ap.locator('.mission-stage svg').screenshot({path:'test-results/stage-middle.png'});
  await ap.waitForTimeout(1450);const terminal=await physical(ap);assert.notEqual(terminal,initial);
  const endPixels=await ap.locator('.mission-stage svg').screenshot({path:'test-results/stage-after-a.png'});assert.notDeepEqual(midPixels,endPixels,'animation changes rendered pixels');
  assert.equal(await ap.locator('.mission-stage').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  await ap.locator('.journey-mission-choices [data-mission-choice="b"]').click();await ap.waitForTimeout(100);await ap.locator('#motion').click();
  assert.equal(await ap.locator('.mission-stage').evaluate(e=>e.getAnimations({subtree:true}).length),0,'pause settles the chosen scene');
  assert.equal(await ap.locator('.mission-stage').getAttribute('data-choice-id'),'b');
  await ap.locator('#motion').click();await ap.locator('.journey-mission-choices [data-mission-choice="a"]').click();await ap.locator('.journey-mission-choices [data-mission-choice="b"]').click();
  await ap.waitForTimeout(1450);assert.equal(await ap.locator('.mission-stage').getAttribute('data-choice-id'),'b');assert.equal(await ap.locator('.mission-stage').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  await ap.emulateMedia({reducedMotion:'reduce'});await ap.locator('.journey-mission-choices [data-mission-choice="a"]').click();assert.equal(await ap.locator('.mission-stage').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  await animated.close();results.push('Normal motion has real intermediate positions and pixels, settles, survives rapid retargeting, and respects pause and live reduced-motion changes');
  const en=await context({viewport:{width:390,height:844}}),ep=await boot(en,new URL('?lang=en',base).href);await task(ep,'marketing','creator');
  assert.doesNotMatch(await ep.locator('.mission-stage figcaption').innerText(),/[\u4e00-\u9fff]/);assert.ok((await ep.locator('.mission-stage svg title').textContent()).length>0);await en.close();results.push('English stage descriptions and accessible SVG titles work on mobile');
  assert.deepEqual(errors,[]);await writeFile('test-results/animated-mission-results.json',JSON.stringify({base,results,errors},null,2));console.log(results.join('\n'));
} finally {await browser.close();}
