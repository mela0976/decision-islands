import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:4175/';
const browser = await chromium.launch({headless:true});
const results = [], errors = [];
await mkdir('test-results/change-cues',{recursive:true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function pixels(page) {
  const box = await page.locator('.mission-stage').locator('canvas,svg').boundingBox();
  return hash(await page.screenshot({timeout:30000,clip:{x:Math.ceil(box.x)+2,y:Math.ceil(box.y)+56,width:Math.floor(box.width)-4,height:Math.floor(box.height)-58}}));
}
async function click(page, selector) { await page.locator(selector).evaluate(button=>button.click()); }
try {
  for (const sample of [
    {width:390,height:844,role:'family',audience:'everyday'},
    {width:360,height:740,role:'marketer',audience:'marketing'},
    {width:360,height:740,role:'family',audience:'everyday',fallback:true},
  ]) {
    const ctx = await browser.newContext({viewport:{width:sample.width,height:sample.height},reducedMotion:'reduce'});
    if (sample.fallback) await ctx.addInitScript(()=>{
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...args){return String(kind).includes('webgl')?null:getContext.call(this,kind,...args);};
    });
    const page = await ctx.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);
    await page.locator('.article-row').first().waitFor({state:'attached'});
    await page.clock.install();
    await click(page,'#enter');
    await click(page,`#journey-picker [data-audience="${sample.audience}"]`);
    await click(page,`#journey-picker [data-role="${sample.role}"]`);
    await click(page,'[data-skip-question]');
    await page.locator(`.mission-stage[data-renderer="${sample.fallback?'fallback':'webgl'}"]`).waitFor();
    await click(page,'.journey-mission-choices [data-mission-choice="a"]');
    assert.notEqual(await page.locator('.mission-stage').getAttribute('data-cue-active'),'true','initial choice does not start comparison cues');
    const after = await pixels(page);
    await click(page,'[data-mission-view="before"]');
    assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'true');
    const token = await page.locator('.mission-stage').getAttribute('data-cue-token');
    const labels = await page.locator('[data-change-cue-label]').allTextContents();
    assert.ok(labels.length>=1 && labels.length<=2);
    assert.ok(labels.every(label=>[...label].length<=18),JSON.stringify(labels));
    const bounds = await page.locator('[data-change-cue-label]').evaluateAll(nodes=>nodes.map(node=>{
      const box=node.getBoundingClientRect();
      return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,font:Number.parseFloat(getComputedStyle(node).fontSize)};
    }));
    assert.ok(bounds.every(box=>box.font>=12 && box.left>=0 && box.right<=sample.width && box.top>=0 && box.bottom<=sample.height),JSON.stringify(bounds));
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'),'a');
    const activeBefore = await pixels(page);
    await page.screenshot({timeout:30000,path:`test-results/change-cues/${sample.width}-${sample.role}-${sample.fallback?'svg':'3d'}-active.png`});
    await click(page,'[data-mission-view="before"]');
    assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-token'),token,'the pressed side does not restart the cue');
    await page.clock.fastForward(2300);
    assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'false');
    assert.notEqual(await pixels(page),activeBefore,'highlight changes actual scene pixels, not just its caption');
    await click(page,'[data-mission-view="after"]');
    assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'true');
    assert.notEqual(await pixels(page),after,'after view highlights actual scene objects');
    await page.clock.fastForward(2300);
    assert.equal(await pixels(page),after,'the result pixels restore exactly after the highlight');
    await click(page,'[data-mission-view="before"]');
    await page.clock.fastForward(1000);
    await click(page,'[data-mission-view="after"]');
    await page.clock.fastForward(1300);
    assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'true','the old expiry cannot clear a newer cue');
    await page.clock.fastForward(1000);
    assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'false');
    await click(page,'[data-mission-view="before"]');
    await click(page,'.journey-mission-choices [data-mission-choice="b"]');
    assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'false','changing the choice clears the old cue');
    assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'),'b');
    assert.equal(await page.locator('.mission-stage').getAttribute('data-comparison-view'),'after');
    if (!sample.fallback && sample.role==='family') {
      await click(page,'[data-mission-compare]');
      await click(page,'[data-mission-view="before"]');
      await page.locator('.mission-stage-canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await page.locator('.mission-stage[data-renderer="fallback"] svg').waitFor();
      assert.equal(await page.locator('.journey-mission-feedback').getAttribute('data-choice-id'),'b');
      assert.equal(await page.locator('.mission-stage').getAttribute('data-preview'),'true');
      assert.equal(await page.locator('.mission-stage').getAttribute('data-comparison-view'),'before');
      await page.clock.fastForward(2300);
      assert.equal(await page.locator('.mission-stage').getAttribute('data-cue-active'),'false');
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    results.push(`${sample.width}px ${sample.role} ${sample.fallback?'SVG':'WebGL'}: actual brief highlights, short readable hints, exact restoration, latest toggle wins and answer isolation`);
    await ctx.close();
  }
  assert.deepEqual(errors,[]);
} finally {
  await writeFile('test-results/change-cues/results.json',JSON.stringify({base,results,errors},null,2));
  await browser.close();
}
console.log(results.join('\n'));
