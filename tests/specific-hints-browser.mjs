import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.TEST_URL || 'http://127.0.0.1:4176/';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let journey,resolveCue;
try {
  ({JOURNEY_2026:journey}=await server.ssrLoadModule('/src/reading-journeys.ts'));
  ({resolveMissionChangeCue:resolveCue}=await server.ssrLoadModule('/src/mission-change-cues.ts'));
} finally {await server.close();}
const routes=journey.personas.flatMap(role=>role.questions.map(question=>({role:role.id,audience:role.audienceId,question})));
const browser=await chromium.launch({headless:true});
const results=[],errors=[];
const click=(page,selector)=>page.locator(selector).evaluate(button=>button.click());
await mkdir('test-results/specific-hints',{recursive:true});
try {
  for(const sample of [{language:'zh',width:360,height:740,renderer:'webgl'},{language:'en',width:360,height:740,renderer:'fallback'}].filter(sample=>!process.env.TEST_LANGUAGE || sample.language===process.env.TEST_LANGUAGE)) {
    const ctx=await browser.newContext({viewport:{width:sample.width,height:sample.height},reducedMotion:'reduce'});
    if(sample.renderer==='fallback') await ctx.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...args){return String(kind).includes('webgl')?null:original.call(this,kind,...args);};
    });
    const page=await ctx.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    const url=new URL(base);url.searchParams.set('lang',sample.language);
    await page.goto(url.href);
    await page.locator('.article-row').first().waitFor({state:'attached'});
    await page.clock.install();await page.clock.pauseAt(new Date());
    let count=0;const captured=new Set();
    for(const route of routes) {
      if(await page.locator('#my-reading').isVisible()) await click(page,'#my-reading');
      else await click(page,'#enter');
      await click(page,`#journey-picker [data-audience="${route.audience}"]`);
      await click(page,`#journey-picker [data-role="${route.role}"]`);
      await click(page,`#journey-picker [data-question="${route.question.id}"]`);
      await page.locator(`.mission-stage[data-renderer="${sample.renderer}"]`).waitFor();
      for(let round=0;round<3;round++) {
        const mission=route.question.steps[round].mission;
        assert.equal(await page.locator('.journey-mission').getAttribute('data-mission-id'),mission.id);
        if(await page.locator('[data-mission-retry]').count()) await click(page,'[data-mission-retry]');
        for(const choiceId of ['a','b']) {
          await click(page,`.journey-mission-choices [data-mission-choice="${choiceId}"]`);
          for(const view of ['before','after']) {
            await page.locator('.mission-stage').evaluate(node=>node.scrollIntoView({block:'nearest',behavior:'instant'}));
            await click(page,`[data-mission-view="${view}"]`);
            assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'true',`${mission.id}/${choiceId}/${view}`);
            const expected=resolveCue({key:mission.id,definition:mission.visual,choiceId,previewChoiceId:null,comparisonView:view},sample.renderer==='webgl'?'webgl':'svg').labels.map(label=>label[sample.language]);
            assert.deepEqual(await page.locator('[data-change-cue-label]').allTextContents(),expected);
            const layout=await page.locator('[data-change-cue-label]').evaluateAll(nodes=>nodes.map(node=>{
              const box=node.getBoundingClientRect();const caption=node.closest('figcaption').getBoundingClientRect();
              return {font:parseFloat(getComputedStyle(node).fontSize),left:box.left,right:box.right,top:box.top,bottom:box.bottom,captionBottom:caption.bottom,width:node.clientWidth,scrollWidth:node.scrollWidth};
            }));
            assert.ok(layout.length>=1 && layout.length<=2);
            assert.ok(layout.every(box=>box.font>=12 && box.left>=0 && box.right<=sample.width && box.top>=0 && box.bottom<=sample.height && box.bottom<=box.captionBottom+.5 && box.scrollWidth<=box.width+1),`${mission.id}/${choiceId}/${view}/${sample.language}: ${JSON.stringify(layout)}`);
            assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'),choiceId);
            if(view==='after' && choiceId==='a' && !captured.has(route.role)) {
              await page.screenshot({timeout:30000,path:`test-results/specific-hints/${sample.language}-${route.role}.png`});captured.add(route.role);
            }
          }
          count++;
        }
        if(round===0) {
          await click(page,'[data-mission-compare]');
          await click(page,'[data-mission-view="before"]');
          assert.equal(await page.locator('.mission-stage-change-cue-context').isVisible(),true);
          assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'),'b');
          const expected=resolveCue({key:mission.id,definition:mission.visual,choiceId:'b',previewChoiceId:'a',comparisonView:'before'},sample.renderer==='webgl'?'webgl':'svg').labels.map(label=>label[sample.language]);
          assert.deepEqual(await page.locator('[data-change-cue-label]').allTextContents(),expected);
          const previewFits=await page.locator('[data-change-cue-label]').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1));
          assert.equal(previewFits,true,`${mission.id}/${sample.language}: preview hint remains fully readable`);
          await click(page,'[data-mission-compare]');
        }
        if(round<2) await click(page,'.journey-mission [data-action="advance"]');
      }
      if(count%24===0) console.log(`${sample.language}: checked ${count}/96 choice hints`);
    }
    assert.equal(count,96);assert.equal(captured.size,8);
    results.push(`${sample.language} ${sample.renderer}: all 96 choices show the correct specific before/after hints at 360px, full text fits at 12px, preview keeps the adopted answer`);
    await ctx.close();
  }
  assert.deepEqual(errors,[]);
} finally {
  await writeFile('test-results/specific-hints/browser-results.json',JSON.stringify({base,results,errors},null,2));
  await browser.close();
}
console.log(results.join('\n'));
